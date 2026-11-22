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

export interface IncomingCall {
  from: string;
  /** Name of the lead or contact the number belongs to, when it matches one. */
  leadName: string | null;
  /** Who owns that lead now. */
  ownerName: string | null;
  /** Who last called that number, which is who the callback is really for. */
  lastCallerName: string | null;
}

/**
 * Whether this rep's line is registered with Telnyx and therefore able to receive a
 * callback. A credentials-based connection refuses an inbound call at the SIP layer
 * when nothing is registered, so this is worth showing rather than guessing at.
 */
export type LineStatus = 'offline' | 'connecting' | 'ready';

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
  /** Set while an inbound call is ringing, before anyone answers it. */
  incoming: IncomingCall | null;
  /** True while an answered inbound call is up, so it can be ended from anywhere. */
  inboundActive: boolean;
  /** Whether the line is registered and can take a callback right now. */
  lineStatus: LineStatus;
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
  startCall: (leadPhone: string, leadId?: string, leadTable?: 'leads' | 'linkedin_leads') => Promise<void>;
  endCall: () => void;
  /** Clears a finished call so the next lead in a queue starts clean. */
  resetCall: () => void;
  /** Answer the inbound call that is ringing on this rep's line. */
  answerIncoming: () => void;
  /** Refuse it, which also silences it here. */
  rejectIncoming: () => void;
  /** Tear the idle registration down and open it again, for a line that went quiet. */
  reconnectLine: () => void;
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
  callInProgress: boolean;
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
    incoming: null,
    inboundActive: false,
    lineStatus: 'offline',
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
  const callStartedRef = useRef(false);
  const endedHandledRef = useRef(false);
  // The registration held open while no call is up, so an inbound call has somewhere
  // to arrive. Separate from clientRef, which belongs to a call being placed.
  const idleClientRef = useRef<any>(null);
  // The inbound call that is ringing, or the one that was answered.
  const inboundCallRef = useRef<any>(null);
  // Mirrors "a call is up" for callbacks that cannot see fresh state.
  const busyRef = useRef(false);
  // Whether that idle registration is up right now, taken from the SDK's own events
  // rather than guessed from its internals.
  const idleReadyRef = useRef(false);
  // When the last registration attempt was started, so the keep-alive backs off instead
  // of tearing a connecting line down over and over.
  const lineAttemptAtRef = useRef(0);

  useEffect(() => {
    busyRef.current = ['connecting', 'ringing', 'in-call', 'held'].includes(state.status);
  }, [state.status]);

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
    // Set muted initially to satisfy browser autoplay policies
    audioEl.muted = true;
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

  const unmuteAudioElement = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current.muted = false;
    }
  }, []);

  // Attach remote stream, set volume/muted, and call play() — used on every call state change
  const attachAndPlayAudio = useCallback((label: string) => {
    const audioEl = audioElementRef.current;
    const call = callRef.current;
    if (!audioEl) {
      console.warn('[attachAndPlayAudio]', label, '— no audio element');
      return;
    }

    // Attach remote stream
    const remoteStream = call?.remoteStream ?? null;
    if (remoteStream && audioEl.srcObject !== remoteStream) {
      audioEl.srcObject = remoteStream;
    }

    // Set volume
    audioEl.volume = remoteVolume;

    // Unmute
    audioEl.muted = false;

    // Debug log
    console.warn('[attachAndPlayAudio]', label, {
      srcObject: audioEl.srcObject ? 'present' : 'null',
      muted: audioEl.muted,
      volume: audioEl.volume,
      paused: audioEl.paused,
      currentTime: audioEl.currentTime,
      remoteStreamPresent: !!remoteStream,
      remoteStreamActive: remoteStream?.active,
      trackCount: remoteStream?.getTracks().length,
    });

    // Call play() and catch rejection
    if (audioEl.paused) {
      audioEl.play().then(() => {
        console.warn('[attachAndPlayAudio] play() succeeded', label, {
          paused: audioEl.paused,
          currentTime: audioEl.currentTime,
        });
      }).catch((playErr: any) => {
        console.warn('[attachAndPlayAudio] play() rejected:', {
          label,
          message: playErr?.message,
          name: playErr?.name,
          code: playErr?.code,
        });
      });
    } else {
      console.warn('[attachAndPlayAudio] already playing', label);
    }
  }, [remoteVolume]);

  // Debug helper to log setSinkId
  const applyOutputDevice = useCallback((deviceId: string) => {
    if (!audioElementRef.current) return;
    if (deviceId === '' || deviceId === 'default') {
      console.warn('setSinkId: using default device');
      return;
    }
    audioElementRef.current.setSinkId(deviceId).then(() => {
      console.warn('setSinkId:', deviceId);
    }).catch((e: any) => {
      console.warn('setSinkId failed:', deviceId, e?.message || e);
    });
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
    let tempStream: MediaStream | null = null;
    try {
      tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        setMicPermission('denied');
      }
      // still attempt enumerate on failure
    }
    // Then enumerate — labels will be available now
    await enumerateDevices();
    // Release the temporary stream so the mic isn’t kept open just for permission
    if (tempStream) {
      tempStream.getTracks().forEach(track => track.stop());
    }
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
    applyOutputDevice(deviceId);
  }, [canChangeOutputDevice, applyOutputDevice]);

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

    // Hangup the call — skip if already in a terminal state to avoid
    // "CALL DOES NOT EXIST" errors when the SDK already hung up
    if (callRef.current) {
      const terminalStates = ['hangup', 'destroy', 'purge', 'ended'];
      const currentCallState = callRef.current.state;
      const stateStr = typeof currentCallState === 'string' ? currentCallState : '';
      if (!terminalStates.includes(stateStr)) {
        try {
          callRef.current.hangup();
        } catch (e) {
          // Call may already be hung up
        }
      }
    }
    // Disconnect the client
    if (clientRef.current) {
      try {
        clientRef.current.removeAllListeners();
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
    callStartedRef.current = false;
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

  // --- Inbound calls ---
  // A business calling the shared number back. Everybody registered on the same Telnyx
  // credentials receives the invite, so the decision of who it belongs to is made by
  // the server and everyone it does not belong to hangs up, leaving one phone ringing
  // instead of the whole team's browsers.
  const handleInboundInvite = useCallback(async (call: any) => {
    const from = String(call?.remotePartyNumber ?? call?.callerNumber ?? '');
    const hangUp = (reason: string) => {
      console.warn('[inbound] refusing the call:', reason);
      try { call?.hangup?.(); } catch { /* the SDK may have ended it already */ }
    };

    console.warn('[inbound] invite received', {
      from,
      direction: call?.direction,
      state: String(call?.state),
      busy: busyRef.current,
      alreadyRinging: Boolean(inboundCallRef.current),
    });

    // A previous invite whose end never arrived would otherwise make every later call be
    // refused as "already ringing here", which would look exactly like this: the caller
    // gets declined a fraction of a second after dialing, over and over.
    const previous = inboundCallRef.current;
    if (previous) {
      const previousState = String(previous?.state ?? '');
      const finished = ['hangup', 'destroy', 'purge', 'ended'].includes(previousState);
      if (finished || !previousState) {
        console.warn('[inbound] clearing a stale ringing flag left by an earlier call', { previousState });
        inboundCallRef.current = null;
        setState(s => (s.incoming ? { ...s, incoming: null } : s));
      }
    }

    // One line per person: never while a call is up, and never two rings at once.
    if (busyRef.current || inboundCallRef.current) {
      hangUp(busyRef.current ? 'a call is already up on this line' : 'already ringing here');
      return;
    }

    let info: {
      mine?: boolean;
      leadName?: string | null;
      ownerName?: string | null;
      lastCallerName?: string | null;
    } | null = null;

    try {
      const res = await authFetch(`/api/inbound/who?number=${encodeURIComponent(from)}`);
      if (res.ok) info = await res.json();
      console.warn('[inbound] who said', { status: res.status, info });
    } catch (err) {
      // Best effort. If the lookup fails, let it ring here rather than drop a real call.
      console.warn('[inbound] who lookup failed, letting it ring here', err);
    }

    if (info && info.mine === false) {
      hangUp('it belongs to another rep');
      return;
    }

    console.warn('[inbound] ringing on this line', { from, leadName: info?.leadName ?? null });
    inboundCallRef.current = call;
    setState(s => ({
      ...s,
      incoming: {
        from: from || 'unknown number',
        leadName: info?.leadName ?? null,
        ownerName: info?.ownerName ?? null,
        lastCallerName: info?.lastCallerName ?? null,
      },
    }));
  }, []);

  const rejectIncoming = useCallback(() => {
    const call = inboundCallRef.current;
    inboundCallRef.current = null;
    setState(s => ({ ...s, incoming: null }));
    try { call?.hangup?.(); } catch { /* already ended */ }
  }, []);

  // The idle line's effect must stay mounted while it waits, so it reaches these
  // through a ref instead of depending on their identities. attachAndPlayAudio, for
  // one, changes whenever the call volume does, and depending on it directly would
  // tear down the line and drop a call that was ringing.
  const idleHelpersRef = useRef({
    handleInboundInvite,
    setupAudioElement,
    attachAndPlayAudio,
    startDurationTimer,
    stopDurationTimer,
  });

  useEffect(() => {
    idleHelpersRef.current = {
      handleInboundInvite,
      setupAudioElement,
      attachAndPlayAudio,
      startDurationTimer,
      stopDurationTimer,
    };
  }, [handleInboundInvite, setupAudioElement, attachAndPlayAudio, startDurationTimer, stopDurationTimer]);

  // Bumped to force the idle line to be torn down and registered again.
  const [lineGeneration, setLineGeneration] = useState(0);

  const reconnectLine = useCallback(() => {
    setState(s => ({ ...s, lineStatus: 'connecting' }));
    setLineGeneration(g => g + 1);
  }, []);

  // --- Keep the line registered ---
  // A credentials-based Telnyx connection only accepts an inbound call while an endpoint
  // is registered. A line that drops quietly is worse than no line at all: the caller is
  // refused at the SIP layer (SIP 480, before anything reaches a browser) and it looks
  // like the ring is broken. This watches for that and opens the line again, backing off
  // so a line that is mid-handshake is not torn down repeatedly.
  useEffect(() => {
    const check = setInterval(() => {
      if (busyRef.current) return;
      if (idleReadyRef.current && idleClientRef.current) return;
      if (Date.now() - lineAttemptAtRef.current < 15000) return;
      console.warn('[idle-line] not registered, opening the line again');
      setLineGeneration(g => g + 1);
    }, 10000);

    return () => clearInterval(check);
  }, []);

  // --- Idle line for inbound calls ---
  // The client used to be built only when dialing, so a call arriving while the app sat
  // idle had nothing registered to arrive on. This keeps one registration open whenever
  // no call is up, and drops it the moment one starts, because two registrations would
  // deliver the same invite twice.
  //
  // The guard depends on the user id rather than the user object: the auth context hands
  // out a fresh object on some renders, which would tear the line down and rebuild it,
  // leaving a window with no registration to receive a call.
  useEffect(() => {
    const userId = user?.id ?? null;
    if (!userId || !callerNumber) return;
    if (state.status !== 'idle' && state.status !== 'ended' && state.status !== 'error') return;

    // A line kept alive through an answered inbound call is disconnected here on the way
    // out, before the fresh one below takes over, so the connection does not double up.
    const previous = idleClientRef.current;
    if (previous) {
      try {
        previous.removeAllListeners?.();
        previous.disconnect?.();
      } catch {
        // Already gone.
      }
      idleClientRef.current = null;
    }

    let cancelled = false;
    let client: any = null;

    const onNotification = (notification: any) => {
      if (notification?.type !== 'callUpdate' || !notification.call) return;
      const call = notification.call;

      // This line never dials, so anything not inbound is not ours.
      if (call.direction !== 'inbound') {
        return;
      }

      const callState = String(call.state);

      if (callState === 'ringing' || callState === 'requesting') {
        void idleHelpersRef.current.handleInboundInvite(call);
        return;
      }

      if (callState === 'active') {
        if (!answeredAtRef.current) {
          answeredAtRef.current = Date.now();
          // The inbound call takes the line, so the shared controls (mute, hold, end)
          // work on it through the same paths as an outbound call.
          callRef.current = call;
          setState(s => ({
            ...s,
            status: 'in-call',
            message: 'Inbound call',
            incoming: null,
            inboundActive: true,
          }));
          idleHelpersRef.current.startDurationTimer();
          idleHelpersRef.current.attachAndPlayAudio('active');
        }
        return;
      }

      if (callState === 'held') {
        setState(s => ({ ...s, status: 'held' }));
        return;
      }

      if (callState === 'hangup' || callState === 'destroy' || callState === 'purge') {
        if (endedHandledRef.current) return;
        endedHandledRef.current = true;
        inboundCallRef.current = null;
        callRef.current = null;
        answeredAtRef.current = null;
        idleHelpersRef.current.stopDurationTimer();
        setState(s => ({
          ...s,
          incoming: null,
          inboundActive: false,
          status: 'idle',
          message: '',
          durationSeconds: 0,
          isMuted: false,
          isHeld: false,
        }));
      }
    };

    (async () => {
      try {
        const tokenRes = await authFetch('/api/telnyx/token', { method: 'GET' });
        if (!tokenRes.ok) {
          lineAttemptAtRef.current = Date.now();
          setState(s => ({ ...s, lineStatus: 'offline' }));
          console.warn('[idle-line] no login token, the line stays closed', { status: tokenRes.status });
          return;
        }
        const tokenData = await tokenRes.json();
        if (cancelled) return;

        const { TelnyxRTC } = await import('@telnyx/webrtc');
        if (cancelled) return;

        client = new TelnyxRTC({
          login_token: tokenData.token,
          debug: false,
          hangupOnBeforeUnload: true,
          mediaPermissionsRecovery: { enabled: true, timeout: 10000 },
        } as any);

        idleClientRef.current = client;

        idleHelpersRef.current.setupAudioElement();
        client.remoteElement = 'telnyx-remote-audio';

        client.on('telnyx.notification', onNotification);
        client.on('telnyx.ready', () => {
          idleReadyRef.current = true;
          setState(s => ({ ...s, lineStatus: 'ready' }));
          console.warn('[idle-line] registered with Telnyx, waiting for calls');
        });
        client.on('telnyx.socket.close', () => {
          idleReadyRef.current = false;
          setState(s => ({ ...s, lineStatus: 'offline' }));
          console.warn('[idle-line] socket closed, the line is no longer registered');
        });
        client.on('telnyx.error', (err: any) => {
          console.warn('[idle-line] error from the line:', err?.message || err);
        });

        lineAttemptAtRef.current = Date.now();
        setState(s => ({ ...s, lineStatus: 'connecting' }));
        client.connect();
      } catch (err) {
        lineAttemptAtRef.current = Date.now();
        setState(s => ({ ...s, lineStatus: 'offline' }));
        console.warn('Could not open the idle line for inbound calls:', err);
      }
    })();

    return () => {
      cancelled = true;
      // An answered inbound call lives on this client. Disconnecting here would drop the
      // call the rep is on, so it is handed over to the next effect run instead.
      if (inboundCallRef.current) return;
      idleReadyRef.current = false;
      try {
        client?.removeAllListeners?.();
        client?.disconnect?.();
      } catch {
        // Best effort.
      }
      if (idleClientRef.current === client) idleClientRef.current = null;
    };
  }, [user?.id, callerNumber, state.status, lineGeneration]);

  // --- startCall ---
  const startCall = useCallback(async (leadPhone: string, leadId?: string, leadTable: 'leads' | 'linkedin_leads' = 'leads') => {
    if (!user) {
      setState(s => ({ ...s, status: 'error', message: 'Authentication required.' }));
      return;
    }
    if (['connecting', 'ringing', 'in-call', 'held'].includes(state.status)) {
      // Prevent double-dial
      return;
    }

    // The idle line goes before dialing: with two registrations the same inbound call
    // would arrive twice and one line would hold two calls.
    try {
      idleClientRef.current?.removeAllListeners?.();
      idleClientRef.current?.disconnect?.();
    } catch {
      // Best effort.
    }
    idleClientRef.current = null;

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
    endedHandledRef.current = false;
    stopDurationTimer();
    clearMuteWarningTimeout();

    try {
      // The clock starts before the request, not after: a click made before the
      // machine slept is answered on wake, and dialing then rings a number nobody
      // asked for at that moment.
      const requestedAt = Date.now();

      // Create the call log row FIRST
      const callLogRes = await authFetch('/api/telnyx/call-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_number: toNumber,
          lead_id: leadId || null,
          lead_table: leadTable,
        }),
      });

      if (!callLogRes.ok) {
        const errData = await callLogRes.json();
        throw new Error(errData.error || 'Failed to create call log');
      }
      const callLogData = await callLogRes.json();
      currentCallLogIdRef.current = callLogData.callLogId ?? null;

      // A request that took this long did not go out when it was asked to. The row
      // is closed off and no call is placed, rather than ringing a number minutes
      // after the click.
      if (Date.now() - requestedAt > 20000) {
        if (currentCallLogIdRef.current) {
          updateCallLog(currentCallLogIdRef.current, {
            status: 'failed',
            ended_at: new Date().toISOString(),
          });
        }
        throw new Error('Nothing was dialed: the request took too long to go through, which happens if the machine was asleep. Try again.');
      }

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
      // Added mediaPermissionsRecovery per Telnyx docs for better error handling
      const client = new TelnyxRTC({
        login_token: jwt,
        debug: false,
        hangupOnBeforeUnload: true,
        mediaPermissionsRecovery: {
          enabled: true,
          timeout: 10000,
        },
      } as any);

      clientRef.current = client;
      isCleaningUpRef.current = false;
      callStartedRef.current = false;

      // Set up remote audio element
      const audioEl = setupAudioElement();
      // Apply saved volume
      audioEl.volume = remoteVolume;
      // Register the audio element as the SDK remote element (primary path)
      client.remoteElement = 'telnyx-remote-audio';
      // Apply saved output device (secondary fallback if setSinkId differs)
      if (selectedOutputDevice) {
        applyOutputDevice(selectedOutputDevice);
      }

      // Register event listeners
      client.on('telnyx.ready', () => {
        // Guard: only create the call once per client instance.
        // The SDK may fire telnyx.ready again after a WebSocket reconnect (e.g. after
        // ICE failure), which would redial the same number without this guard.
        if (callStartedRef.current) return;
        callStartedRef.current = true;
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

        // Debug: log device and mic state when the call starts
        if (localStreamRef.current) {
          const tracks = localStreamRef.current.getAudioTracks();
          console.warn('Call started with:', {
            selectedInputDevice: selectedInputDevice,
            audioTrackEnabled: tracks[0]?.enabled ?? null,
            audioTrackMuted: tracks[0]?.muted ?? null,
            streamActive: localStreamRef.current.active,
            streamTrackCount: localStreamRef.current.getTracks().length,
            isMuted: state.isMuted,
          });
        } else {
          console.warn('Call started but localStreamRef is null');
        }

        // Start the call — await the Promise as per Telnyx docs (invite() returns Promise<void>)
        void call.invite().catch((inviteErr: any) => {
          console.error('Call invite promise rejected:', {
            message: inviteErr?.message,
            name: inviteErr?.name,
            code: inviteErr?.code,
            toString: String(inviteErr),
            keys: Object.keys(inviteErr || {}),
          });
          setState(s => ({
            ...s,
            status: 'error',
            message: inviteErr?.message || 'Failed to initiate call. The browser may have blocked autoplay — try clicking the call button again.',
          }));
        });
      });

      // Handle events via telnyx.notification on the client
      // In SDK v2.28.0, call state changes come through client.on('telnyx.notification'),
      // NOT call.on() — call objects do not have an on() method in this version.
      client.on('telnyx.notification', (notification: any) => {
        if (notification.type !== 'callUpdate' || !notification.call) return;

        const call = notification.call;

        // A callback arriving while this line is already busy is refused here. Only one
        // call at a time, and the idle line is not registered while a call is up.
        if (call.direction === 'inbound') {
          try { call.hangup(); } catch { /* the SDK may have ended it already */ }
          return;
        }

        // In v2.28.0, call.state comes as a STRING in notifications (not the numeric enum)
        // Per Telnyx docs: call.state values are 'ringing', 'active', etc.
        const callState = String(call.state);

        // Log every callUpdate received
        console.warn('[call state]', callState, 'prev:', call.prevState, 'remoteStream:', !!call.remoteStream);

        if (callState === 'early' && !answeredAtRef.current) {
          // Outbound calls may report 'early' instead of 'ringing'
          attachAndPlayAudio('early');
          setState(s => s.status === 'connecting' ? { ...s, status: 'ringing' } : s);
        } else if (callState === 'ringing' && !answeredAtRef.current) {
          // Unmute audio element during ringing to hear ringback tone
          attachAndPlayAudio('ringing');
          setState(s => s.status === 'connecting' ? { ...s, status: 'ringing' } : s);
        } else if (callState === 'active' && !answeredAtRef.current) {
          answeredAtRef.current = Date.now();
          setState(s => ({ ...s, status: 'in-call', message: 'Call connected' }));
          startDurationTimer();
          attachAndPlayAudio('active');
        } else if (callState === 'held') {
          setState(s => ({ ...s, status: 'held' }));
          attachAndPlayAudio('held');
        } else if (callState === 'hangup' || callState === 'destroy' || callState === 'purge') {
          // Guard: only handle end-of-call once per call instance
          if (endedHandledRef.current) return;
          endedHandledRef.current = true;
          console.warn('Call ended:', {
            state: callState,
            cause: call.cause,
            causeCode: call.causeCode,
            sipCode: call.sipCode,
            keys: Object.keys(call),
          });
          const duration = answeredAtRef.current
            ? Math.floor((Date.now() - answeredAtRef.current) / 1000)
            : 0;
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
            toNumber: null,
            fromNumber: null,
            callerNumber: null,
          }));
          stopDurationTimer();
          cleanup();
        }
      });

      // Handle telnyx.error on the client
      client.on('telnyx.error', (err: any) => {
        console.error('Telnyx error:', {
          message: err?.message,
          name: err?.name,
          code: err?.code,
          type: err?.type,
          toString: String(err),
          keys: Object.keys(err || {}),
        });
        
        // Check for known error codes from the SDK
        let errorMsg = err?.message || 'Telnyx connection error';
        
        // Handle specific error types
        try {
          // If it's a TELNYX_ERROR_CODES value, provide a human-readable message
          const code = err?.code;
          if (code !== undefined) {
            errorMsg = `Telnyx error code ${code}: ${err?.message || 'Unknown error'}`;
          }
        } catch {
          // fall back to original message
        }
        
        setState(s => ({
          ...s,
          status: 'error',
          message: errorMsg,
        }));
        stopDurationTimer();
      });

      // Debug: subscribe to telnyx.warning events
      // These come from the CallReportCollector during active calls
      client.on('telnyx.warning', (warning: any) => {
        console.warn('Telnyx warning:', {
          code: warning?.warning?.code ?? warning?.code,
          name: warning?.warning?.name ?? warning?.name,
          message: warning?.warning?.message ?? warning?.message,
          callId: warning?.callId,
        });
      });

      // Debug: subscribe to telnyx.stats.report (end-of-call stats)
      client.on('telnyx.stats.report', (report: any) => {
        console.log('Telnyx stats report:', report);
      });

      // Debug: subscribe to telnyx.stats.frame (periodic stats during a call)
      let lastStatsLog = 0;
      client.on('telnyx.stats.frame', (frame: any) => {
        const now = Date.now();
        // Log once every 5 seconds to avoid flooding the console
        if (now - lastStatsLog < 5000) return;
        lastStatsLog = now;
        const stats = frame?.stats || frame;
        console.log('Telnyx stats frame:', {
          rtt: stats?.rtt,
          jitter: stats?.jitter,
          packetLoss: stats?.packetLossFraction,
          mos: stats?.mos,
          quality: stats?.quality,
          callId: frame?.callId,
        });
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

  // --- resetCall ---
  // Puts a finished call aside so the next lead starts clean. A queue works through
  // leads in the same panel, so without this the ended state and the previous call
  // log id carried over: the call button stayed hidden and a saved outcome could be
  // attached to the previous lead's call.
  const resetCall = useCallback(() => {
    stopDurationTimer();
    clearMuteWarningTimeout();
    answeredAtRef.current = null;
    endedHandledRef.current = false;
    currentCallLogIdRef.current = null;

    setState(s => ({
      ...s,
      status: 'idle',
      message: '',
      durationSeconds: 0,
      isMuted: false,
      isHeld: false,
      callLogId: null,
      fromNumber: null,
      toNumber: null,
      remoteMutedForMoreThan10s: false,
      inboundActive: false,
    }));
  }, [stopDurationTimer, clearMuteWarningTimeout]);

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
    if (currentCallLogIdRef.current) {
      updateCallLog(currentCallLogIdRef.current, {
        status: duration > 0 ? 'answered' : 'no_answer',
        duration_seconds: duration > 0 ? duration : null,
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
          const terminalStates = ['hangup', 'destroy', 'purge', 'ended'];
          const currentCallState = callRef.current.state;
          const stateStr = typeof currentCallState === 'string' ? currentCallState : '';
          if (!terminalStates.includes(stateStr)) {
            await callRef.current.hangup();
          }
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

  // Kept here rather than with the rest of the inbound code because it needs the
  // microphone helper, which is defined above.
  const answerIncoming = useCallback(async () => {
    const call = inboundCallRef.current;
    if (!call) return;
    // Ask for the microphone before answering so the caller does not sit in silence
    // while the browser permission prompt is on screen.
    try {
      await requestMicrophone();
    } catch {
      // The SDK asks again when it answers.
    }
    try {
      call.answer();
    } catch (err) {
      console.error('Answering the inbound call failed:', err);
    }
  }, [requestMicrophone]);

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
    resetCall,
    answerIncoming,
    rejectIncoming,
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
    reconnectLine,
    callInProgress: ['connecting', 'ringing', 'in-call', 'held'].includes(state.status),
  };
}
