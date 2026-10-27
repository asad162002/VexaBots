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
  Volume2,
  Play,
  Pause,
} from 'lucide-react';
import { useCall } from '@/components/queue/CallProvider';

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
    callInProgress,
    startCall,
    endCall,
    toggleMute,
    toggleHold,
    setVolume,
    setMicVolume,
  } = useCall();

  const isCalling = ['connecting', 'ringing', 'in-call', 'held'].includes(status);
  const inCall = status === 'ringing' || status === 'in-call' || status === 'held';

  const handleStartCall = () => {
    if (!lead?.phone) return;
    startCall(lead.phone, lead.id);
  };

  const handleEndCall = () => {
    endCall();
  };

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
      <div className="bg-[#13131a] border border-[#23232e] rounded-xl p-3">
        <p className="text-sm text-gray-500">This lead has no phone number.</p>
      </div>
    );
  }

  const isError = status === 'error';

  return (
    <div className="bg-[#13131a] border border-[#23232e] rounded-xl p-3">
      <div className="space-y-3">
        {/* Phone number display */}
        <div className="flex items-center gap-2 text-sm">
          <Phone className="w-4 h-4 text-gray-500" />
          <span className="text-gray-300">{lead.phone}</span>
        </div>

        {/* Caller ID */}
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

        {/* Call status pill */}
        {status === 'connecting' || status === 'ringing' ? (
          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-[#2a2410] text-yellow-400 border border-yellow-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse"></span>
            Ringing...
          </span>
        ) : inCall ? (
          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-[#14261c] text-green-400 border border-green-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
            Connected
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-[#14261c] text-green-400 border border-green-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
            Ready
          </span>
        )}

        {/* Call button (idle) */}
        {!inCall && !callEnded && hookCallerNumber && (
          <button
            onClick={handleStartCall}
            disabled={isCalling}
            className="w-full flex items-center justify-center gap-2 bg-[#16a34a] hover:bg-[#15803d] active:bg-[#14532d] disabled:bg-[#1a2a1a] disabled:border disabled:border-[#2b2b3a] text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition disabled:cursor-not-allowed"
          >
            {isCalling ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{message || 'Starting call...'}</span>
              </>
            ) : (
              <>
                <Phone className="w-4 h-4" />
                <span>Call now</span>
              </>
            )}
          </button>
        )}

        {/* Volume sliders (pre-call + in-call) */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Mic className="w-3 h-3" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={micVolume}
              onChange={(e) => setMicVolume(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-[#181821] rounded cursor-pointer slider"
              aria-label="Microphone volume"
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Volume2 className="w-3 h-3" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={remoteVolume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-[#181821] rounded cursor-pointer slider"
              aria-label="Speaker volume"
            />
          </div>
        </div>

        {/* In-call: timer + controls */}
        {callInProgress && (
          <div className="flex flex-col items-center gap-3">
            <div className="text-center">
              <div className="text-xl font-bold text-white font-mono">{formatDuration(durationSeconds)}</div>
              {message && (
                <div className="text-xs text-gray-500 mt-0.5">
                  {message}
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-2">
              <button
                onClick={toggleMute}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition flex items-center gap-1.5 ${
                  isMuted
                    ? 'bg-[#4a1a1a] border border-[#f87171] text-[#f87171]'
                    : 'bg-[#181821] border border-[#262633] text-gray-300 hover:bg-[#1f1f2b] hover:text-white'
                }`}
                title={isMuted ? 'Unmute microphone' : 'Mute microphone (M)'}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                {isMuted ? 'Muted' : 'Mute'}
              </button>

              <button
                onClick={toggleHold}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition flex items-center gap-1.5 ${
                  isHeld
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#181821] border border-[#262633] text-gray-300 hover:bg-[#1f1f2b] hover:text-white'
                }`}
                title={isHeld ? 'Resume call' : 'Hold call'}
              >
                {isHeld ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                {isHeld ? 'Resume' : 'Hold'}
              </button>

              <button
                className="px-3 py-2 rounded-xl text-xs font-medium bg-[#181821] border border-[#262633] text-gray-300 hover:bg-[#1f1f2b] hover:text-white transition"
                title="Send to voicemail"
              >
                <Mic className="w-4 h-4" />
              </button>

              <button
                className="px-3 py-2 rounded-xl text-xs font-medium bg-[#181821] border border-[#262633] text-gray-300 hover:bg-[#1f1f2b] hover:text-white transition"
                title="Skip lead"
              >
                <Play className="w-4 h-4 rotate-90" />
              </button>
            </div>

            <button
              onClick={handleEndCall}
              className="px-6 py-2 rounded-xl bg-[#f87171] hover:bg-[#ef4444] active:bg-[#dc2626] text-white font-semibold text-sm transition"
              title="End call"
            >
              End call
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
          <div className="flex items-center gap-2 p-3 bg-[#1a1a23] border border-[#2a2a36] rounded-xl">
            <CheckCircle className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-300">
              Call ended.
            </span>
          </div>
        )}

        {isError && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-sm text-red-400">{message}</span>
          </div>
        )}
      </div>
    </div>
  );
}
