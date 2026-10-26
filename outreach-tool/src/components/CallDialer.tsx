'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { type CallLog } from '@/lib/types';
import {
  Phone,
  AlertCircle,
  Clock,
  Loader2,
  CheckCircle,
  Mic,
  MicOff,
  PhoneOff,
  Volume2,
  Play,
  Pause,
} from 'lucide-react';
import { useTelnyxCall } from '@/hooks/use-telnyx-call';

interface CallDialerProps {
  lead: {
    id: string;
    phone: string | null;
    country_code: string | null;
    owner_name: string | null;
  } | null;
  onCallEnd?: (callLog: CallLog) => void;
}

export default function CallDialer({ lead, onCallEnd }: CallDialerProps) {
  const { callerNumber: hookCallerNumber, user } = useAuth();
  const [callEnded, setCallEnded] = useState(false);

  const {
    status,
    message,
    durationSeconds,
    isMuted,
    isHeld,
    callLogId,
    remoteVolume,
    micVolume,
    startCall,
    endCall,
    toggleMute,
    toggleHold,
    sendDTMF,
    setVolume,
    setMicVolume,
  } = useTelnyxCall();

  const isCalling = ['connecting', 'ringing', 'in-call', 'held'].includes(status);
  const inCall = status === 'ringing' || status === 'in-call' || status === 'held';

  const handleStartCall = () => {
    if (!lead?.phone) return;
    startCall(lead.phone, lead.id);
  };

  const handleEndCall = () => {
    endCall();
  };

  // Notify parent when call ends
  useEffect(() => {
    if (status === 'ended' && !callEnded) {
      setCallEnded(true);
      onCallEnd?.({
        id: callLogId || '',
        lead_id: lead?.id || '',
        caller_id: user?.id || '',
        from_number: hookCallerNumber || '',
        to_number: lead?.phone || '',
        status: 'disconnected',
        duration_seconds: durationSeconds,
        recorded_url: null,
        recording_url: null,
        call_id: null,
        telnyx_call_control_id: null,
        telnyx_call_session_id: null,
        started_at: null,
        ended_at: new Date().toISOString(),
        call_control_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }, [status, callEnded, callLogId, durationSeconds, hookCallerNumber, lead, user, onCallEnd]);

  // Reset callEnded when starting a new call
  useEffect(() => {
    if (status === 'idle') {
      setCallEnded(false);
    }
  }, [status]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!lead?.phone) {
    return (
      <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-5">
        <p className="text-sm text-gray-400">This lead has no phone number.</p>
      </div>
    );
  }

  const isError = status === 'error';

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

        {!hookCallerNumber ? (
          <p className="text-xs text-gray-500">
            No caller number configured for your account. Ask your admin to assign you a Telnyx caller-ID number.
          </p>
        ) : (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <CheckCircle className="w-3 h-3 text-green-500/60" />
            <span>Calling from {hookCallerNumber}</span>
          </div>
        )}

        {!inCall && !callEnded && hookCallerNumber && (
          <button
            onClick={handleStartCall}
            disabled={isCalling}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 active:bg-green-700 disabled:bg-green-800 text-white font-semibold rounded-lg px-4 py-3 text-sm transition disabled:cursor-not-allowed"
          >
            {isCalling ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{message || 'Starting call...'}</span>
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
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 text-gray-300 font-mono">
              <Clock className="w-4 h-4" />
              {formatDuration(durationSeconds)}
            </div>

            <div className="flex items-center flex-wrap justify-center gap-2">
              {/* Mute */}
              <button
                onClick={toggleMute}
                className={`p-2 rounded-lg transition ${
                  isMuted
                    ? 'bg-red-600 text-white'
                    : 'bg-[#27272a] text-gray-300 hover:bg-[#3f3f46]'
                }`}
                title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              {/* Hold / Resume */}
              <button
                onClick={toggleHold}
                className={`p-2 rounded-lg transition ${
                  isHeld
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#27272a] text-gray-300 hover:bg-[#3f3f46]'
                }`}
                title={isHeld ? 'Resume call' : 'Hold call'}
              >
                {isHeld ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>

              {/* DTMF Keypad */}
              {['1','2','3','4','5','6','7','8','9','*','0','#'].map((d) => (
                <button
                  key={d}
                  onClick={() => sendDTMF(d)}
                  className="px-2 py-1 text-xs bg-[#27272a] hover:bg-[#3f3f46] text-gray-300 rounded transition"
                  aria-label={`DTMF ${d}`}
                >
                  {d}
                </button>
              ))}
            </div>

            {/* Speaker volume */}
            <div className="flex items-center gap-2 w-full max-w-xs">
              <Volume2 className="w-4 h-4 text-gray-500" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={remoteVolume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="flex-1 h-2 bg-[#27272a] rounded-lg appearance-none cursor-pointer slider"
                aria-label="Speaker volume"
              />
              <span className="text-xs text-gray-500 w-8 text-right">
                {Math.round(remoteVolume * 100)}%
              </span>
            </div>

            {/* Mic volume */}
            <div className="flex items-center gap-2 w-full max-w-xs">
              <Mic className="w-4 h-4 text-gray-500" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={micVolume}
                onChange={(e) => setMicVolume(parseFloat(e.target.value))}
                className="flex-1 h-2 bg-[#27272a] rounded-lg appearance-none cursor-pointer slider"
                aria-label="Microphone volume"
              />
              <span className="text-xs text-gray-500 w-8 text-right">
                {Math.round(micVolume * 100)}%
              </span>
            </div>

            {/* End call */}
            <button
              onClick={endCall}
              className="p-2 rounded-lg bg-red-600 hover:bg-red-500 text-white transition"
              title="End call"
            >
              <PhoneOff className="w-4 h-4" />
            </button>
          </div>
        )}

        {(status === 'connecting' || status === 'ringing') && (
          <div className="flex items-center justify-center gap-2 text-yellow-400">
            <Clock className="w-4 h-4 animate-pulse" />
            <span>{message || 'Connecting...'}</span>
          </div>
        )}

        {callEnded && (
          <div className="flex items-center gap-2 p-3 bg-gray-500/10 border border-gray-500/30 rounded-lg">
            <CheckCircle className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-300">
              Call ended.
            </span>
          </div>
        )}

        {isError && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-sm text-red-400">{message}</span>
          </div>
        )}
      </div>
    </div>
  );
}
