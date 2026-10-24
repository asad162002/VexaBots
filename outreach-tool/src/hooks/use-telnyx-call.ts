import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/auth-fetch';
import { type CallLog } from '@/lib/types';

// Hook for making Telnyx WebRTC calls using the @telnyx/webrtc SDK.
//
// What I verified from the installed @telnyx/webrtc (v2.28.0) package:
// - The SDK exports `TelnyxRTC` which takes `IClientOptions.login_token` (a JWT)
// - `client.connect()` initiates the WebSocket connection to rtc.telnyx.com
// - The `telnyx.ready` event fires when the client is registered and can make calls
// - `client.newCall({ destinationNumber, callerNumber })` creates an outbound call
// - `client.on('telnyx.notification', cb)` receives all events; call state changes
//   come as `{ type: 'callUpdate', call }` where `call.state` maps to the State enum:
//   New=0, Ringing=4, Active=7, Hangup=9
// - `call.hangup()` ends the call, `call.muteAudio()` toggles mic
//
// The JWT login_token is obtained from /api/telnyx/token (which calls
// POST /v2/telephony_credentials/{id}/token — NOT the non-existent
// /v2/connections/tokens endpoint).

export type CallStatus =
  | 'idle'
  | 'connecting'
  | 'ringing'
  | 'in-call'
  | 'ended'
  | 'error';

export interface TelnyxCallState {
  status: CallStatus;
  message: string;
  durationSeconds: number;
  isMuted: boolean;
  callLogId: string | null;
  fromNumber: string | null;
  toNumber: string | null;
  callerNumber: string | null;
}

export interface UseTelnyxCallReturn extends TelnyxCallState {
  startCall: (leadPhone: string, leadId?: string) => Promise<void>;
  endCall: () => void;
  toggleMute: () => void;
  requestMicrophone: () => Promise<MediaStream | null>;
}

const E164_US_REGEX = /^\+1\d{10}$/;

function normalizeToE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (phone.startsWith('+')) return phone;
  return `+${digits}`;
}

export function useTelnyxCall(): UseTelnyxCallReturn {
  const { user, callerNumber } = useAuth();
  const [state, setState] = useState<TelnyxCallState>({
    status: 'idle',
    message: '',
    durationSeconds: 0,
    isMuted: false,
    callLogId: null,
    fromNumber: null,
    toNumber: null,
    callerNumber: callerNumber ?? null,
  });

  const clientRef = useRef<any>(null);
  const callRef = useRef<any>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const answeredAtRef = useRef<number | null>(null);
  const currentCallLogIdRef = useRef<string | null>(null);

  // Keep callerNumber in sync from auth context
  useEffect(() => {
    setState(s => ({ ...s, callerNumber: callerNumber ?? null }));
  }, [callerNumber]);

  const startDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    durationIntervalRef.current = setInterval(() => {
      if (answeredAtRef.current) {
        setState(s => ({
          ...s,
          durationSeconds: Math.floor((Date.now() - answeredAtRef.current!) / 1000),
        }));
      }
    }, 1000);
  }, []);

  const stopDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  const updateCallLog = useCallback(async (
    callLogId: string,
    updates: Partial<CallLog>
  ) => {
    try {
      const res = await authFetch(`/api/telnyx/call-log/${callLogId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const err = await res.text();
        console.error('Failed to update call log:', err);
      }
    } catch (err) {
      console.error('Call log update error:', err);
    }
  }, []);

  const startCall = useCallback(async (leadPhone: string, leadId?: string) => {
    if (!user) {
      setState(s => ({ ...s, status: 'error', message: 'Authentication required.' }));
      return;
    }

    const toNumber = normalizeToE164(leadPhone);
    if (!E164_US_REGEX.test(toNumber)) {
      setState(s => ({ ...s, status: 'error', message: 'Please enter a valid US phone number.' }));
      return;
    }

    if (!callerNumber) {
      setState(s => ({
        ...s,
        status: 'error',
        message: 'Ask your admin to assign you a Telnyx caller-ID number.',
      }));
      return;
    }

    // Request microphone access BEFORE dialing
    // Per Telnyx best practice: get permission before creating the call
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setState(s => ({
        ...s,
        status: 'error',
        message: 'Microphone access denied. Check your browser permissions.',
      }));
      return;
    }

    setState(s => ({
      ...s,
      status: 'connecting',
      message: 'Connecting to Telnyx...',
      toNumber,
      fromNumber: callerNumber,
      callerNumber,
      durationSeconds: 0,
    }));

    answeredAtRef.current = null;
    stopDurationTimer();

  try {
      // Create the call log row FIRST (via call-log-only endpoint — no REST)
      const callLogRes = await authFetch('/api/telnyx/call-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_number: toNumber,
          lead_id: leadId || null,
        }),
      });

      if (!callLogRes.ok) {
        const errData = await callLogRes.json();
        throw new Error(errData.error || 'Failed to create call log');
      }
      const callLogData = await callLogRes.json();
      currentCallLogIdRef.current = callLogData.callLogId ?? null;

      setState(s => ({
        ...s,
        callLogId: callLogData.callLogId ?? null,
      }));

      // Get a WebRTC login token from our backend
      const tokenRes = await authFetch('/api/telnyx/token', { method: 'GET' });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) {
        throw new Error(tokenData.error || 'Failed to get Telnyx token');
      }

      const jwt = tokenData.token;

      // Dynamically import the Telnyx SDK
      const { TelnyxRTC } = await import('@telnyx/webrtc');

      // Create the TelnyxRTC client with the login_token (JWT)
      const client = new TelnyxRTC({
        login_token: jwt,
      } as any);

      clientRef.current = client;

      // Set up remote audio element
      if (!audioElementRef.current) {
        const audioEl = document.createElement('audio') as HTMLAudioElement & { playsInline: boolean };
        audioEl.autoplay = true;
        audioEl.playsInline = true;
        audioEl.id = 'telnyx-remote-audio';
        document.body.appendChild(audioEl);
        audioElementRef.current = audioEl;
      }
      // The SDK can attach the remote stream via the remoteStream property
      // of the Call object

      // Register event listeners
      client.on('telnyx.ready', () => {
        // Client is registered — now create the call
        const call = client.newCall({
          destinationNumber: toNumber,
          callerNumber: callerNumber,
        }) as any;

        callRef.current = call;

        // Capture Telnyx SDK call identifiers from the Call object
        // Verified from @telnyx/webrtc BaseCall.d.ts: call.telnyxIDs returns
        // { telnyxCallControlId, telnyxSessionId, telnyxLegId }
        let telnyxCallControlId: string | null = null;
        let telnyxCallSessionId: string | null = null;
        try {
          const ids = call?.telnyxIDs;
          telnyxCallControlId = ids?.telnyxCallControlId ?? null;
          telnyxCallSessionId = ids?.telnyxSessionId ?? null;
        } catch (e) {
          console.warn('Could not read call.telnyxIDs:', e);
        }

        // PATCH the call log with the Telnyx call IDs so the webhook
        // can match incoming events to this call_log row
        if (currentCallLogIdRef.current && telnyxCallControlId) {
          void updateCallLog(currentCallLogIdRef.current, {
            telnyx_call_control_id: telnyxCallControlId,
            telnyx_call_session_id: telnyxCallSessionId,
          });
        }

        // Track the call for state updates
        client.on('telnyx.notification', (notification: any) => {
          if (notification.type !== 'callUpdate' || !notification.call) return;

          const call = notification.call;
          const callState = call.state; // State enum: 0=New, 4=Ringing, 7=Active, 9=Hangup

          // Also try to capture telnyx IDs from the notification call object
          // (they may not have been available immediately after newCall())
          try {
            const ids = call?.telnyxIDs;
            if (ids?.telnyxCallControlId && currentCallLogIdRef.current) {
              void updateCallLog(currentCallLogIdRef.current, {
                telnyx_call_control_id: ids.telnyxCallControlId,
                telnyx_call_session_id: ids.telnyxSessionId ?? null,
              });
            }
          } catch (e) {
            // telnyxIDs not available yet — already captured in newCall callback
          }

          // State enum: New=0, Trying=1, Ringing=4, Answering=5, Early=6, Active=7, Held=8, Hangup=9
          if (callState >= 7) {
            // Active call
            if (answeredAtRef.current === null) {
              answeredAtRef.current = Date.now();
              startDurationTimer();
            }
            setState(s => ({
              ...s,
              status: 'in-call',
              message: 'Connected. You are live.',
              isMuted: false,
            }));
          } else if (callState === 4) {
            // Ringing
            setState(s => ({
              ...s,
              status: 'ringing',
              message: 'Ringing...',
            }));
          } else if (callState === 9 || callState === 10) {
            // Hangup or Destroy
            stopDurationTimer();
            let duration = 0;
            if (answeredAtRef.current !== null) {
              duration = Math.floor((Date.now() - answeredAtRef.current) / 1000);
            }

            // Update the call log with final status and duration
            if (currentCallLogIdRef.current) {
              const finalStatus = duration > 0 ? 'answered' : 'no_answer';
              void updateCallLog(currentCallLogIdRef.current, {
                status: finalStatus,
                duration_seconds: duration > 0 ? duration : null,
                ended_at: new Date().toISOString(),
              });
            }

            setState(s => ({
              ...s,
              status: 'ended',
              message: 'Call ended.',
              durationSeconds: duration,
              isMuted: false,
            }));
            cleanup();
          }
        });

        // Handle the remote media stream
        call.on('trackAdded', (event: any) => {
          if (audioElementRef.current && event?.stream) {
            audioElementRef.current.srcObject = event.stream;
          }
        });

        // Start the call
        call.invite();
      });

      client.on('telnyx.error', (err: any) => {
        console.error('Telnyx error:', err);
        setState(s => ({
          ...s,
          status: 'error',
          message: err?.message || 'Telnyx connection error',
        }));
        stopDurationTimer();
      });

      // Connect to Telnyx signaling
      client.connect();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start call';
      console.error('Call error:', err);
      setState(s => ({ ...s, status: 'error', message: msg }));
      stopDurationTimer();
      cleanup();
    }
  }, [user, callerNumber]);

  const cleanup = useCallback(() => {
    if (callRef.current) {
      try {
        callRef.current.hangup();
      } catch (e) {
        // Call may already be hung up
      }
    }
    if (clientRef.current) {
      try {
        clientRef.current.disconnect();
      } catch (e) {
        // Best effort
      }
    }
    if (audioElementRef.current) {
      audioElementRef.current.srcObject = null;
    }
    callRef.current = null;
    clientRef.current = null;
  }, []);

  const endCall = useCallback(() => {
    stopDurationTimer();

    // Compute final duration from answeredAtRef (not from a stale closure)
    let duration = 0;
    if (answeredAtRef.current !== null) {
      duration = Math.floor((Date.now() - answeredAtRef.current) / 1000);
      answeredAtRef.current = null;
    }

    // Update the call log with final duration
    if (currentCallLogIdRef.current && duration > 0) {
      updateCallLog(currentCallLogIdRef.current, {
        status: 'disconnected',
        duration_seconds: duration,
        ended_at: new Date().toISOString(),
      });
    }

    setState(s => ({
      ...s,
      status: 'ended',
      message: 'Call ended.',
      durationSeconds: duration,
      isMuted: false,
    }));

    cleanup();
  }, [updateCallLog, stopDurationTimer, cleanup]);

  const toggleMute = useCallback(() => {
    if (callRef.current) {
      try {
        callRef.current.toggleAudioMute();
      } catch (e) {
        console.warn('toggleAudioMute failed, trying muteAudio:', e);
        try {
          if (state.isMuted) {
            callRef.current.unmuteAudio();
          } else {
            callRef.current.muteAudio();
          }
        } catch (e2) {
          console.warn('Audio mute toggle failed:', e2);
        }
      }
    }
    setState(s => ({ ...s, isMuted: !s.isMuted }));
  }, [state.isMuted]);

  const requestMicrophone = useCallback(async (): Promise<MediaStream | null> => {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.error('Microphone access failed:', err);
      return null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
      stopDurationTimer();
    };
  }, [cleanup, stopDurationTimer]);

  return {
    ...state,
    startCall,
    endCall,
    toggleMute,
    requestMicrophone,
  };
}
