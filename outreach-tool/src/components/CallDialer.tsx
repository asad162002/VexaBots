'use client';

import { useState, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { type CallLog, type CallStatus } from '@/lib/types';
import { Phone, AlertCircle, Clock, Loader2, CheckCircle, Mic, MicOff, Volume2, VolumeX, PhoneOff } from 'lucide-react';

interface CallDialerProps {
  lead: {
    id: string;
    phone: string | null;
    country_code: string | null;
    owner_name: string | null;
  } | null;
  onCallEnd?: (callLog: CallLog) => void;
}

const STATUS_BADGE: Record<CallStatus, { label: string; className: string }> = {
  initiated: { label: 'Dialing', className: 'bg-gray-500/20 text-gray-300 border-gray-500/30' },
  ringing: { label: 'Ringing', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  answered: { label: 'Answered', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  busy: { label: 'Busy', className: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  voicemail: { label: 'Voicemail', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  no_answer: { label: 'No Answer', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
  disconnected: { label: 'Disconnected', className: 'bg-gray-500/20 text-gray-300 border-gray-500/30' },
};

interface CallState {
  status: CallStatus;
  message: string;
  duration: number;
  isMuted: boolean;
  isHandsetMuted: boolean;
}

export default function CallDialer({ lead, onCallEnd }: CallDialerProps) {
  const { callerNumber, user } = useAuth();
  const [call, setCall] = useState<CallState>({
    status: 'initiated',
    message: '',
    duration: 0,
    isMuted: false,
    isHandsetMuted: false,
  });
  const [isCalling, setIsCalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [callEnded, setCallEnded] = useState(false);

  const deviceRef = useRef<any>(null);
  const callRef = useRef<any>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const normalizeToE164 = (phone: string): string => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    if (phone.startsWith('+')) return phone;
    return `+${digits}`;
  };

  const getTelnyxToken = async (): Promise<string> => {
    const res = await fetch('/api/telnyx/token', { method: 'GET' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to get Telnyx token');
    return data.token;
  };

  const startCall = async () => {
    if (!lead?.phone) {
      setError('No phone number on this lead.');
      return;
    }
    if (!callerNumber) {
      setError('No caller number. Add a US number in Settings.');
      return;
    }

    setError(null);
    setCallEnded(false);
    setIsCalling(true);
    setCall(prev => ({ ...prev, status: 'initiated', message: 'Getting Telnyx token...' }));

    try {
      const token = await getTelnyxToken();
      setCall(prev => ({ ...prev, message: 'Connecting to Telnyx...' }));

      const { TelnyxRTC } = await import('@telnyx/webrtc');

      // Cast to any — the SDK's TypeScript types don't fully match the runtime API
      const TelnyxRTCAny = TelnyxRTC as any;
      const device = new TelnyxRTCAny({});

      device.on('trackAdded', (event: any) => {
        const audioEl = document.getElementById('telnyx-audio') as HTMLMediaElement | null;
        if (audioEl && event?.stream) {
          audioEl.srcObject = event.stream;
        }
      });

      device.on('callEvents', (event: any) => {
        const evt: any = event;
        const eventName = evt.event;
        const statusVal = evt.callState;

        switch (eventName) {
          case 'ringing':
            setCall(p => ({ ...p, status: 'ringing', message: 'Ringing...' }));
            break;
          case 'answered':
            setCall(p => ({ ...p, status: 'answered', message: 'Connected. You are live.' }));
            break;
          case 'hangup': {
            setCall(p => ({ ...p, status: 'disconnected', message: 'Call ended.' }));
            endCallCleanup();
            break;
          }
          case 'cancel':
            setCall(p => ({ ...p, status: 'no_answer', message: 'No answer.' }));
            endCallCleanup();
            break;
          case 'busy':
            setCall(p => ({ ...p, status: 'busy', message: 'Line is busy.' }));
            endCallCleanup();
            break;
          default:
            console.log('Telnyx event:', eventName, evt);
        }
      });

      await device.init();
      await device.login(token);
      deviceRef.current = device;

      setCall(prev => ({ ...prev, message: 'Dialing...' }));

      const toNumber = normalizeToE164(lead.phone);
      const fromNumber = callerNumber;

      const callOptions = {
        to: toNumber,
        from: fromNumber,
        record: 'record-from-answer-dual',
      };

      const telnyxCall = device.call(callOptions);
      callRef.current = telnyxCall;

      durationIntervalRef.current = setInterval(() => {
        setCall(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);

      // Get microphone access
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (device.deviceId && telnyxCall) {
          telnyxCall._mediaStream = stream;
        }
      } catch (err) {
        console.warn('Could not access microphone:', err);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start call';
      setError(msg);
      setCall(p => ({ ...p, status: 'disconnected', message: msg }));
      setIsCalling(false);
    }
  };

  const endCallCleanup = () => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (deviceRef.current) {
      try {
        deviceRef.current.disconnect();
      } catch (e) {
        console.warn('Error disconnecting:', e);
      }
    }
    setCallEnded(true);
    setIsCalling(false);

    onCallEnd?.({
      id: '',
      lead_id: lead?.id || '',
      caller_id: user?.id || '',
      from_number: callerNumber || '',
      to_number: lead?.phone || '',
      status: 'disconnected',
      duration_seconds: call.duration,
      recorded_url: null,
      recording_url: null,
      call_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  };

  const endCall = useCallback(() => {
    if (deviceRef.current) {
      try {
        deviceRef.current.disconnect();
      } catch (e) {
        console.warn('Error disconnecting:', e);
      }
    }
    endCallCleanup();
  }, [call.duration, callerNumber, lead?.id, lead?.phone, user?.id, onCallEnd]);

  const toggleMute = () => {
    if (deviceRef.current) {
      const dev = deviceRef.current as any;
      if (typeof dev.mute === 'function') {
        dev.mute(!call.isMuted);
      }
    }
    setCall(prev => ({ ...prev, isMuted: !prev.isMuted }));
  };

  const toggleHandsetMute = () => {
    setCall(prev => ({ ...prev, isHandsetMuted: !prev.isHandsetMuted }));
  };

  if (!lead?.phone) {
    return (
      <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-5">
        <p className="text-sm text-gray-400">This lead has no phone number.</p>
      </div>
    );
  }

  const inCall = call.status === 'ringing' || call.status === 'answered' || call.status === 'initiated';

  return (
    <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-5">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
        Phone Dialer
      </h2>

      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <Phone className="w-4 h-4 text-gray-500" />
          <span className="text-gray-300">{lead.phone}</span>
        </div>

        {!callerNumber ? (
          <p className="text-xs text-gray-500">
            No caller number configured for your account. Contact an admin to add one.
          </p>
        ) : (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <CheckCircle className="w-3 h-3 text-green-500/60" />
            <span>Calling from {callerNumber}</span>
          </div>
        )}

        <audio id="telnyx-audio" autoPlay playsInline className="hidden" />

        {!inCall && !callEnded && callerNumber && (
          <button
            onClick={startCall}
            disabled={isCalling}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 active:bg-green-700 disabled:bg-green-800 text-white font-semibold rounded-lg px-4 py-3 text-sm transition disabled:cursor-not-allowed"
          >
            {isCalling ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Starting call...</span>
              </>
            ) : (
              <>
                <Phone className="w-4 h-4" />
                <span>Call Now</span>
              </>
            )}
          </button>
        )}

        {inCall && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-gray-400">
              <Clock className="w-4 h-4" />
              <span className="text-gray-300 font-mono">{formatDuration(call.duration)}</span>
            </div>
            <button
              onClick={toggleMute}
              className={`p-2 rounded-lg transition ${
                call.isMuted
                  ? 'bg-red-600 text-white'
                  : 'bg-[#27272a] text-gray-300 hover:bg-[#3f3f46]'
              }`}
            >
              {call.isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <button
              onClick={toggleHandsetMute}
              className={`p-2 rounded-lg transition ${
                call.isHandsetMuted
                  ? 'bg-red-600 text-white'
                  : 'bg-[#27272a] text-gray-300 hover:bg-[#3f3f46]'
              }`}
            >
              {call.isHandsetMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              onClick={endCall}
              className="p-2 rounded-lg bg-red-600 hover:bg-red-500 text-white transition"
            >
              <PhoneOff className="w-4 h-4" />
            </button>
          </div>
        )}

        {callEnded && (
          <div className="flex items-center gap-2 p-3 bg-gray-500/10 border border-gray-500/30 rounded-lg">
            <CheckCircle className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-300">
              {STATUS_BADGE[call.status].label} — {call.message}
            </span>
          </div>
        )}

        {call.status === 'busy' && (
          <div className="flex items-center gap-2 p-3 bg-gray-500/10 border border-gray-500/30 rounded-lg">
            <AlertCircle className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-300">Called party is busy.</span>
          </div>
        )}

        {call.status === 'no_answer' && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-sm text-red-400">No answer.</span>
          </div>
        )}

        {call.status === 'answered' && (
          <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
            <CheckCircle className="w-4 h-4 text-green-500/60" />
            <span className="text-sm text-green-400">You are connected. Use the mic button to mute.</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-sm text-red-400">{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
