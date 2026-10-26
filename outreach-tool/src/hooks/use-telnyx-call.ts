import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/auth-fetch';
import { type CallLog } from '@/lib/types';

// Hook for making Telnyx WebRTC calls using the @telnyx/webrtc SDK.
//
// What I verified from the installed @telnyx/webrtc (v2.28.0) package:
//
// CLIENT (TelnyxRTC class — src/TelnyxRTC.d.ts, src/Modules/Verto/BaseSession.d.ts):
//   - constructor({ login_token: string, hangupOnBeforeUnload?: boolean, ... })
//   - connect(): Promise<void> — opens WebSocket to rtc.telnyx.com
//   - disconnect(): Promise<void> — closes WebSocket, cleans up all calls
//   - newCall(ICallOptions): Call — creates outbound call
//   - on(event, cb) / off(event, cb) / removeAllListeners()
//   - Events: 'telnyx.ready', 'telnyx.error', 'telnyx.notification'
//     (BaseSession.d.ts lines 62-65)
//   - NO device enumeration helpers on the client (enumerateDevices, setAudioOutDevice)
//     — those come from standard browser APIs: navigator.mediaDevices
//
// CALL (Call/BaseCall class — src/Modules/Verto/webrtc/BaseCall.d.ts):
//   - invite(): Promise<void> — starts the outbound call
//   - hangup(): Promise<void> — ends the call (async in v2.28, was sync in v2.25)
//     (verified from docs: "SDK 2.26.x — await call.hangup()")
//   - muteAudio(): void / unmuteAudio(): void / toggleAudioMute(): void
//   - isAudioMuted: boolean (getter)
//   - hold(): Promise<any> / unhold(): Promise<any> / toggleHold(): Promise<any>
//   - dtmf(digit: string): void — sends DTMF (0-9, *, #)
//   - setAudioInDevice(deviceId: string, muted?: boolean): Promise<void>
//     — switches microphone during an active call without dropping
//   - getStats(callback: Function, constraints: any): void — WebRTC stats
//   - state: State enum value (0-11, see constants below)
//   - id: string — unique call ID
//   - localStream: MediaStream (getter)
//   - remoteStream: MediaStream (getter)
//   - telnyxIDs: { telnyxCallControlId, telnyxSessionId, telnyxLegId } (getter)
//   - peerConnection: RTCPeerConnection (for advanced use / stats)
//
// State enum (src/Modules/Verto/webrtc/constants.d.ts lines 50-63):
//   New=0, Requesting=1, Trying=2, Recovering=3, Ringing=4,
//   Answering=5, Early=6, Active=7, Held=8, Hangup=9, Destroy=10, Purge=11
//
// ICallOptions (src/utils/interfaces.d.ts lines 59-95):
//   destinationNumber (required), audio (required=true), callerNumber, callerName,
//   micId, speakerId, localElement, remoteElement, localStream, customHeaders,
//   iceServers, trickleIce, forceRelayCandidate
//
// IClientOptions (src/utils/interfaces.d.ts lines 12-58):
//   login_token, debug, hangupOnBeforeUnload (auto-hangup on page close!),
//   keepConnectionAliveOnSocketClose, mediaPermissionsRecovery, etc.
//
// Browser APIs used (SDK does NOT provide these):
//   - navigator.mediaDevices.enumerateDevices() for mic/speaker dropdowns
//   - HTMLMediaElement.setSinkId(deviceId) for speaker switching (not in Safari)
//   - window.AudioContext for mic level meter (AnalyserNode)
//
// The JWT login_token is obtained from /api/telnyx/token (which calls
// POST /v2/telephony_credentials/{credential_id}/token).

export type CallStatus =
  | 'idle'
  | 'connecting'
  | 'ringing'
  | 'in-call'
  | 'held'
  | 'ended'
  | 'error';

export interface TelnyxCallState {
  status: CallStatus;
  message: string;
  durationSeconds: number;
  isMuted: boolean;
  isHeld: boolean;
  callLogId: string | null;
  fromNumber: string | null;
  toNumber: string | null;
  callerNumber: string | null;
  remoteMutedForMoreThan10s: boolean;
}

export interface UseTelnyxCallReturn extends TelnyxCallState {
  // Volume state
  remoteVolume: number;
  micVolume: number;
  // Device state
  availableInputDevices: MediaDeviceInfo[];
  availableOutputDevices: MediaDeviceInfo[];
  selectedInputDevice: string | null;
  selectedOutputDevice: string | null;
  canChangeOutputDevice: boolean;
  micPermission: 'granted' | 'denied' | 'prompt';
  // Audio level (0-1) from the input analyser
  micLevel: number;
  // Call controls
  startCall: (leadPhone: string, leadId?: string) => Promise<void>;
  endCall: () => void;
  toggleMute: () => void;
  setVolume: (volume: number) => void;
  setMicVolume: (volume: number) => void;
  toggleHold: () => void;
  sendDTMF: (digit: string) => void;
  selectInputDevice: (deviceId: string | null) => void;
  selectOutputDevice: (deviceId: string | null) => void;
  refreshDevices: () => Promise<void>;
  requestMicrophone: () => Promise<MediaStream | null>;
  testMicrophone: () => Promise<void>;
  stopTestMicrophone: () => void;
}

// --- State enum mappings (from @telnyx/webrtc constants.d.ts) ---
const STATE = {
  NEW: 0,
  REQUESTING: 1,
  TRYING: 2,
  RECOVERING: 3,
  RINGING: 4,
  ANSWERING: 5,
  EARLY: 6,
  ACTIVE: 7,
  HELD: 8,
  HANGUP: 9,
  DESTROY: 10,
  PURGE: 11,
} as const;

const E164_US_REGEX = /^\+1\d{10}$/;

function normalizeToE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (phone.startsWith('+')) return phone;
  return `+${digits}`;
}

// LocalStorage helpers (all wrapped in try/catch)
function saveDevicePref(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}
function loadDevicePref(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

const LS_INPUT_KEY = 'telnyx_preferred_input_device';
const LS_OUTPUT_KEY = 'telnyx_preferred_output_device';
const LS_VOLUME_KEY = 'telnyx_remote_volume';
const LS_MIC_VOLUME_KEY = 'telnyx_mic_volume';

export function useTelnyxCall(): UseTelnyxCallReturn {
  const { user, callerNumber } = useAuth();

  const [state, setState] = useState<TelnyxCallState>({
    status: 'idle',
    message: '',
    durationSeconds: 0,
    isMuted: false,
    isHeld: false,
    callLogId: null,
    fromNumber: null,
    toNumber: null,
    callerNumber: callerNumber ?? null,
    remoteMutedForMoreThan10s: false,
  });

  const [remoteVolume, setRemoteVolumeState] = useState(() => {
    const saved = loadDevicePref(LS_VOLUME_KEY);
    return saved ? parseFloat(saved) : 1;
  });
  const [micVolume, setMicVolumeState] = useState(() => {
    const saved = loadDevicePref(LS_MIC_VOLUME_KEY);
    return saved ? parseFloat(saved) : 1;
  });

  // Device state
  const [availableInputDevices, setAvailableInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [availableOutputDevices, setAvailableOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedInputDevice, setSelectedInputDevice] = useState<string | null>(
    () => loadDevicePref(LS_INPUT_KEY)
  );
  const [selectedOutputDevice, setSelectedOutputDevice] = useState<string | null>(
    () => loadDevicePref(LS_OUTPUT_KEY)
  );
  const [canChangeOutputDevice, setCanChangeOutputDevice] = useState(false);
  const [micPermission, setMicPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [micLevel, setMicLevel] = useState(0);

  // Refs
  const clientRef = useRef<any>(null);
  const callRef = useRef<any>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const answeredAtRef = useRef<number | null>(null);
  const currentCallLogIdRef = useRef<string | null>(null);
  const muteWarningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isCleaningUpRef = useRef(false);

  // Keep callerNumber in sync from auth context
  useEffect(() => {
    setState(s => ({ ...s, callerNumber: callerNumber ?? null }));
  }, [callerNumber]);

  // --- Duration timer ---
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

  // --- Call log updater ---
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

  // --- Audio element setup ---
  const setupAudioElement = useCallback(() => {
    if (audioElementRef.current) return audioElementRef.current;

    const audioEl = document.createElement('audio') as HTMLAudioElement & { playsInline: boolean };
    audioEl.autoplay = true;
    audioEl.playsInline = true;
    audioEl.id = 'telnyx-remote-audio';
    audioEl.style.display = 'none';
    document.body.appendChild(audioEl);
    audioElementRef.current = audioEl;
    return audioEl;
  }, []);

  // --- Volume control ---
  const setVolume = useCallback((volume: number) => {
    const v = Math.max(0, Math.min(1, volume));
    setRemoteVolumeState(v);
    saveDevicePref(LS_VOLUME_KEY, v.toString());
    if (audioElementRef.current) {
      audioElementRef.current.volume = v;
    }
  }, []);

  const setMicVolume = useCallback((volume: number) => {
    const v = Math.max(0, Math.min(1, volume));
    setMicVolumeState(v);
    saveDevicePref(LS_MIC_VOLUME_KEY, v.toString());
  }, []);

  // --- Device management ---
  const enumerateDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter(d => d.kind === 'audioinput');
      const outputs = devices.filter(d => d.kind === 'audiooutput');
      setAvailableInputDevices(inputs);
      setAvailableOutputDevices(outputs);

      // Check if setSinkId is supported (Safari does not support it)
      const supportsSinkId = typeof HTMLMediaElement.prototype.setSinkId === 'function';
      setCanChangeOutputDevice(supportsSinkId);

      // Load saved device prefs and verify they still exist
      const savedInput = loadDevicePref(LS_INPUT_KEY);
      const savedOutput = loadDevicePref(LS_OUTPUT_KEY);
      if (savedInput && inputs.some(d => d.deviceId === savedInput)) {
        setSelectedInputDevice(savedInput);
      }
      if (savedOutput && supportsSinkId && outputs.some(d => d.deviceId === savedOutput)) {
        setSelectedOutputDevice(savedOutput);
      }
    } catch (err) {
      console.warn('Could not enumerate devices:', err);
    }
  }, []);

  const refreshDevices = useCallback(async () => {
    // Request mic permission first so browsers return device labels
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        setMicPermission('denied');
      }
    }
    // Then enumerate — labels will be available now
    void enumerateDevices();
  }, [enumerateDevices]);

  const selectInputDevice = useCallback((deviceId: string | null) => {
    setSelectedInputDevice(deviceId);
    saveDevicePref(LS_INPUT_KEY, deviceId ?? '');
    // If a call is active, switch the mic on the Call object
    // Verified from BaseCall.d.ts: call.setAudioInDevice(deviceId, muted?)
    if (callRef.current && deviceId) {
      try {
        callRef.current.setAudioInDevice(deviceId);
      } catch (e) {
        console.warn('Could not switch input device on active call:', e);
      }
    }
  }, []);

  const selectOutputDevice = useCallback((deviceId: string | null) => {
    if (!canChangeOutputDevice || !deviceId) return;
    setSelectedOutputDevice(deviceId);
    saveDevicePref(LS_OUTPUT_KEY, deviceId);
    // Apply to the audio element via setSinkId (standard browser API)
    if (audioElementRef.current) {
      try {
        audioElementRef.current.setSinkId(deviceId);
      } catch (e) {
        console.warn('Could not set sink ID:', e);
      }
    }
  }, [canChangeOutputDevice]);

  // --- Microphone test (Web Audio API level meter) ---
  const stopTestMicrophone = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (analyserRef.current) {
      try { analyserRef.current.disconnect(); } catch { /* */ }
      analyserRef.current = null;
    }
  }, []);

  const testMicrophone = useCallback(async () => {
    stopTestMicrophone();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedInputDevice ? { deviceId: selectedInputDevice } : true,
      });
      setMicPermission('granted');
      localStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      analyserRef.current = analyser;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setMicLevel(avg / 255);
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch (err: any) {
      console.error('Mic test failed:', err);
      if (err?.name === 'NotAllowedError') {
        setMicPermission('denied');
      }
    }
  }, [selectedInputDevice, stopTestMicrophone]);

  // --- Mute warning ---
  const clearMuteWarningTimeout = useCallback(() => {
    if (muteWarningTimeoutRef.current) {
      clearTimeout(muteWarningTimeoutRef.current);
      muteWarningTimeoutRef.current = null;
    }
  }, []);

  const scheduleMuteWarning = useCallback(() => {
    clearMuteWarningTimeout();
    muteWarningTimeoutRef.current = setTimeout(() => {
      setState(s => ({ ...s, remoteMutedForMoreThan10s: true }));
    }, 10000);
  }, [clearMuteWarningTimeout]);

  // --- Cleanup ---
  const cleanup = useCallback(() => {
    if (isCleaningUpRef.current) return;
    isCleaningUpRef.current = true;

    stopDurationTimer();
    stopTestMicrophone();
    clearMuteWarningTimeout();

    // Hangup the call
    if (callRef.current) {
      try {
        callRef.current.hangup();
      } catch (e) {
        // Call may already be hung up
      }
    }
    // Disconnect the client
    if (clientRef.current) {
      try {
        clientRef.current.disconnect();
      } catch (e) {
        // Best effort
      }
    }
    // Release local media tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        try { track.stop(); } catch { /* */ }
      });
      localStreamRef.current = null;
    }
    // Detach audio element
    if (audioElementRef.current) {
      audioElementRef.current.srcObject = null;
    }

    callRef.current = null;
    clientRef.current = null;
    answeredAtRef.current = null;
    isCleaningUpRef.current = false;
  }, [stopDurationTimer, stopTestMicrophone, clearMuteWarningTimeout]);

  // --- beforeunload / pagehide: auto-hangup ---
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (['connecting', 'ringing', 'in-call', 'held'].includes(state.status)) {
        try { callRef.current?.hangup?.(); } catch { /* */ }
        try { clientRef.current?.disconnect?.(); } catch { /* */ }
      }
      e.preventDefault();
      e.returnValue = 'You have an active call. Are you sure you want to leave?';
    };

    const handlePageHide = () => {
      if (['connecting', 'ringing', 'in-call', 'held'].includes(state.status)) {
        try { callRef.current?.hangup?.(); } catch { /* */ }
        try { clientRef.current?.disconnect?.(); } catch { /* */ }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [state.status]);

  // --- devicechange listener ---
  useEffect(() => {
    const handleDeviceChange = () => {
      enumerateDevices();
    };
    navigator.mediaDevices?.addEventListener?.('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', handleDeviceChange);
    };
  }, [enumerateDevices]);

  // --- Cleanup on unmount ---
  useEffect(() => {
    // Enumerate devices on mount so device dropdowns are populated before a call
    void enumerateDevices();

    return () => {
      cleanup();
    };
  }, [cleanup, enumerateDevices]);

  // --- startCall ---
  const startCall = useCallback(async (leadPhone: string, leadId?: string) => {
    if (!user) {
      setState(s => ({ ...s, status: 'error', message: 'Authentication required.' }));
      return;
    }
    if (['connecting', 'ringing', 'in-call', 'held'].includes(state.status)) {
      // Prevent double-dial
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

    // Request microphone access
    let stream: MediaStream | null = null;
    try {
      const constraints: MediaStreamConstraints = {
        audio: selectedInputDevice ? { deviceId: selectedInputDevice } : true,
      };
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      setMicPermission('granted');
      localStreamRef.current = stream;
    } catch (err: any) {
      setMicPermission('denied');
      let msg = 'Microphone access denied.';
      if (err?.name === 'NotAllowedError') {
        msg = 'Microphone access denied. Click the lock icon in your browser\'s address bar and allow microphone access, then try again.';
      } else if (err?.name === 'NotFoundError') {
        msg = 'No microphone found. Please connect one and try again.';
      } else if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        msg = 'Microphone access requires HTTPS. Your local server must use https:// or localhost.';
      }
      setState(s => ({ ...s, status: 'error', message: msg }));
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
      isMuted: false,
      isHeld: false,
      remoteMutedForMoreThan10s: false,
    }));

    answeredAtRef.current = null;
    stopDurationTimer();
    clearMuteWarningTimeout();

    try {
      // Create the call log row FIRST
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

      setState(s => ({ ...s, callLogId: callLogData.callLogId ?? null }));

      // Get WebRTC login token
      const tokenRes = await authFetch('/api/telnyx/token', { method: 'GET' });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) {
        throw new Error(tokenData.error || 'Failed to get Telnyx token');
      }

      const jwt = tokenData.token;

      // Dynamically import the Telnyx SDK
      const { TelnyxRTC } = await import('@telnyx/webrtc');

      // Build ICallOptions with device IDs if available
      // Verified from ICallOptions: micId, speakerId, audio, destinationNumber, callerNumber, localStream
      const callOptions: any = {
        destinationNumber: toNumber,
        audio: true,
        callerNumber: callerNumber,
      };
      if (selectedInputDevice) callOptions.micId = selectedInputDevice;
      if (selectedOutputDevice) callOptions.speakerId = selectedOutputDevice;
      if (stream) callOptions.localStream = stream;

      // Create the TelnyxRTC client
      // Verified from IClientOptions: hangupOnBeforeUnload auto-hangs up on page close
      const client = new TelnyxRTC({
        login_token: jwt,
        debug: false,
        hangupOnBeforeUnload: true,
      } as any);

      clientRef.current = client;
      isCleaningUpRef.current = false;

      // Set up remote audio element
      const audioEl = setupAudioElement();
      // Apply saved volume
      audioEl.volume = remoteVolume;

      // Register event listeners
      client.on('telnyx.ready', () => {
        // Client is registered — create the call
        const call = client.newCall(callOptions) as any;
        callRef.current = call;

        // Capture Telnyx SDK call identifiers
        let telnyxCallControlId: string | null = null;
        let telnyxCallSessionId: string | null = null;
        try {
          const ids = call?.telnyxIDs;
          telnyxCallControlId = ids?.telnyxCallControlId ?? null;
          telnyxCallSessionId = ids?.telnyxSessionId ?? null;
        } catch (e) {
          console.warn('Could not read call.telnyxIDs:', e);
        }

        // PATCH the call log with Telnyx call IDs
        if (currentCallLogIdRef.current && telnyxCallControlId) {
          void updateCallLog(currentCallLogIdRef.current, {
            telnyx_call_control_id: telnyxCallControlId,
            telnyx_call_session_id: telnyxCallSessionId,
          });
        }

        // Attach remote stream from the call object
        // Verified from BaseCall.d.ts: call.remoteStream is a getter returning MediaStream
        if (audioEl) {
          try {
            audioEl.srcObject = call.remoteStream || null;
          } catch (e) {
            console.warn('Could not attach remote stream:', e);
          }
        }

        // Start the call
        call.invite();
      });

      // Handle events via telnyx.notification
      client.on('telnyx.notification', (notification: any) => {
        if (notification.type !== 'callUpdate' || !notification.call) return;

        const call = notification.call;
        const callState = call.state as number;

        // Capture telnyx IDs from notification (may differ from newCall)
        try {
          const ids = call?.telnyxIDs;
          if (ids?.telnyxCallControlId && currentCallLogIdRef.current) {
            void updateCallLog(currentCallLogIdRef.current, {
              telnyx_call_control_id: ids.telnyxCallControlId,
              telnyx_call_session_id: ids.telnyxSessionId ?? null,
            });
          }
        } catch (e) {
          // telnyxIDs may not be available yet
        }

        // State machine (from constants.d.ts):
        // New=0, Ringing=4, Active=7, Held=8, Hangup=9, Destroy=10
        if (callState >= STATE.ACTIVE) {
          // Active call
          if (answeredAtRef.current === null) {
            answeredAtRef.current = Date.now();
            startDurationTimer();
          }
          setState(s => ({
            ...s,
            status: 'in-call',
            message: 'Connected. You are live.',
            isMuted: call.isAudioMuted || false,
          }));
        } else if (callState === STATE.RINGING) {
          setState(s => ({
            ...s,
            status: 'ringing',
            message: 'Ringing...',
          }));
        } else if (callState === STATE.HELD) {
          setState(s => ({
            ...s,
            status: 'held',
            message: 'On hold.',
            isHeld: true,
          }));
        } else if (callState >= STATE.HANGUP) {
          // Hangup or Destroy
          stopDurationTimer();
          clearMuteWarningTimeout();

          let duration = 0;
          if (answeredAtRef.current !== null) {
            duration = Math.floor((Date.now() - answeredAtRef.current) / 1000);
          }

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
            message: duration > 0 ? 'Call ended.' : 'Call not answered.',
            durationSeconds: duration,
            isMuted: false,
            isHeld: false,
            remoteMutedForMoreThan10s: false,
          }));
          cleanup();
        }
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

      // Enumerate devices after first call attempt grants mic permission
      void enumerateDevices();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start call';
      console.error('Call error:', err);
      setState(s => ({ ...s, status: 'error', message: msg }));
      stopDurationTimer();
      cleanup();
    }
  }, [user, callerNumber, state.status, selectedInputDevice, selectedOutputDevice, remoteVolume]);

  // --- endCall ---
  // Must always work: hangup + force-cleanup with timeout fallback
  const endCall = useCallback(() => {
    stopDurationTimer();
    clearMuteWarningTimeout();

    // Compute final duration
    let duration = 0;
    if (answeredAtRef.current !== null) {
      duration = Math.floor((Date.now() - answeredAtRef.current) / 1000);
      answeredAtRef.current = null;
    }

    // Update call log with final duration
    if (currentCallLogIdRef.current && duration > 0) {
      updateCallLog(currentCallLogIdRef.current, {
        status: 'disconnected',
        duration_seconds: duration,
        ended_at: new Date().toISOString(),
      });
    }

    // Try graceful hangup, fall back to force cleanup after 3s
    const forceCleanup = setTimeout(() => {
      cleanup();
      setState(s => ({
        ...s,
        status: 'ended',
        message: 'Call ended (forced cleanup).',
        durationSeconds: duration,
        isMuted: false,
        isHeld: false,
        remoteMutedForMoreThan10s: false,
      }));
    }, 3000);

    const doHangup = async () => {
      try {
        if (callRef.current) {
          await callRef.current.hangup();
        }
      } catch (e) {
        console.warn('hangup failed:', e);
      }
      clearTimeout(forceCleanup);
      cleanup();
      setState(s => ({
        ...s,
        status: 'ended',
        message: 'Call ended.',
        durationSeconds: duration,
        isMuted: false,
        isHeld: false,
        remoteMutedForMoreThan10s: false,
      }));
    };

    void doHangup();
  }, [updateCallLog, stopDurationTimer, clearMuteWarningTimeout, cleanup]);

  // --- toggleMute ---
  // Reads actual state from SDK: call.isAudioMuted (verified from BaseCall.d.ts)
  const toggleMute = useCallback(() => {
    if (!callRef.current) return;

    try {
      // Verified from BaseCall.d.ts: toggleAudioMute(): void
      // Also has muteAudio() / unmuteAudio() / isAudioMuted getter
      callRef.current.toggleAudioMute();
      // Read the actual state from the SDK
      const nowMuted = callRef.current.isAudioMuted === true;
      setState(s => ({ ...s, isMuted: nowMuted }));

      if (!nowMuted) {
        // Just unmuted
        clearMuteWarningTimeout();
        setState(s => ({ ...s, remoteMutedForMoreThan10s: false }));
      } else {
        scheduleMuteWarning();
      }
    } catch (e) {
      console.warn('toggleAudioMute failed, trying muteAudio/unmuteAudio:', e);
      try {
        if (state.isMuted) {
          callRef.current.unmuteAudio();
        } else {
          callRef.current.muteAudio();
        }
        const nowMuted = !state.isMuted;
        setState(s => ({ ...s, isMuted: nowMuted }));
        if (nowMuted) scheduleMuteWarning();
        else { clearMuteWarningTimeout(); setState(s => ({ ...s, remoteMutedForMoreThan10s: false })); }
      } catch (e2) {
        console.warn('Audio mute toggle failed:', e2);
      }
    }
  }, [state.isMuted, scheduleMuteWarning, clearMuteWarningTimeout]);

  // --- toggleHold ---
  // Verified from BaseCall.d.ts: hold(): Promise, unhold(): Promise, toggleHold(): Promise
  const toggleHold = useCallback(() => {
    if (!callRef.current || state.status !== 'in-call') return;

    try {
      if (state.isHeld) {
        callRef.current.unhold();
        setState(s => ({ ...s, status: 'in-call', isHeld: false, message: 'Connected. You are live.' }));
      } else {
        callRef.current.hold();
        setState(s => ({ ...s, status: 'held', isHeld: true, message: 'On hold.' }));
      }
    } catch (e) {
      console.warn('Toggle hold failed:', e);
    }
  }, [state.isHeld, state.status]);

  // --- sendDTMF ---
  // Verified from BaseCall.d.ts: dtmf(dtmf: string): void
  const sendDTMF = useCallback((digit: string) => {
    if (!callRef.current || (state.status !== 'in-call' && state.status !== 'held')) return;
    try {
      callRef.current.dtmf(digit);
    } catch (e) {
      console.warn('DTMF send failed:', e);
    }
  }, [state.status]);

  // --- requestMicrophone ---
  const requestMicrophone = useCallback(async (): Promise<MediaStream | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedInputDevice ? { deviceId: selectedInputDevice } : true,
      });
      setMicPermission('granted');
      return stream;
    } catch (err) {
      console.error('Microphone access failed:', err);
      setMicPermission('denied');
      return null;
    }
  }, [selectedInputDevice]);

  // --- Keyboard shortcuts ---
  // M toggles mute during a call (not while typing in inputs)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if focused in an input/textarea
      const activeEl = document.activeElement;
      const isInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA' || activeEl?.hasAttribute('contenteditable');

      if (e.key.toLowerCase() === 'm' && !isInput) {
        const activeStatus = state.status;
        if (activeStatus === 'ringing' || activeStatus === 'in-call' || activeStatus === 'held') {
          e.preventDefault();
          toggleMute();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.status, toggleMute]);

  // Load saved volume on mount
  useEffect(() => {
    if (audioElementRef.current) {
      audioElementRef.current.volume = remoteVolume;
    }
  }, [remoteVolume]);

  return {
    ...state,
    remoteVolume,
    micVolume,
    availableInputDevices,
    availableOutputDevices,
    selectedInputDevice,
    selectedOutputDevice,
    canChangeOutputDevice,
    micPermission,
    micLevel,
    startCall,
    endCall,
    toggleMute,
    setVolume,
    setMicVolume,
    toggleHold,
    sendDTMF,
    selectInputDevice,
    selectOutputDevice,
    refreshDevices,
    requestMicrophone,
    testMicrophone,
    stopTestMicrophone,
  };
}
