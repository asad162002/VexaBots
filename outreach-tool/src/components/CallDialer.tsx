'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { type Lead, type CallLog } from '@/lib/types';
import {
  Phone,
  AlertCircle,
  Clock,
  Loader2,
  CheckCircle,
  Mic,
  MicOff,
  Volume2,
  PhoneOff,
  Play,
  Pause,
} from 'lucide-react';
import { useCall } from '@/components/queue/CallProvider';

interface CallDialerProps {
  lead: Lead;
  onCallEnd?: (callLog: CallLog) => void;
}

// Format phone for display: +1 916-555-0199
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
    if (!lead.phone) return;
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
        lead_id: lead.id,
        caller_id: user?.id || '',
        from_number: hookCallerNumber || '',
        to_number: lead.phone || '',
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

  // Format phone for display: +1 916-555-0199
  const displayPhone = lead.phone
    ? (() => {
        const digits = lead.phone.replace(/\D/g, '');
        if (digits.length === 11 && digits.startsWith('1')) {
          return `+1 ${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
        }
        return lead.phone;
      })()
    : '';

  // Local time calculation (placeholder — reference shows 9:55 PM PT)
  const localTimeDisplay = (() => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 === 0 ? 12 : hours % 12;
    return `${displayHours}:${minutes} ${period}`;
  })();

  // Check if currently outside business hours (9am-6pm)
  const isOutsideBusinessHours = (() => {
    const hours = new Date().getHours();
    return hours < 9 || hours >= 18;
  })();

  if (!lead.phone) {
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
        {/* Status pill + phone number */}
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-[#14261c] text-green-400 border border-green-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
            Ready
          </span>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <span className="w-6 h-6 rounded bg-[#1d1d28] flex items-center justify-center">
              <Phone className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Phone number */}
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-white">{displayPhone}</span>
        </div>

        {/* Info cards: local time, attempts, last call */}
        <div className="grid grid-cols-3 gap-1.5 text-center">
          <div className="bg-[#181821] border border-[#262633] rounded-xl py-2">
            <div className="text-[10px] text-gray-500 uppercase">Local time</div>
            <div className="text-xs text-gray-300">{localTimeDisplay} PT</div>
          </div>
          <div className="bg-[#181821] border border-[#262633] rounded-xl py-2">
            <div className="text-[10px] text-gray-500 uppercase">Attempts</div>
            <div className="text-xs text-gray-300">0</div>
          </div>
          <div className="bg-[#181821] border border-[#262633] rounded-xl py-2">
            <div className="text-[10px] text-gray-500 uppercase">Last call</div>
            <div className="text-xs text-gray-300">Never</div>
          </div>
        </div>

        {/* Business hours warning */}
        {isOutsideBusinessHours && (
          <div className="flex items-center gap-1.5 text-xs text-yellow-400">
            <span>&#9888;</span>
            <span>Outside business hours</span>
          </div>
        )}

        {/* Caller ID field */}
        <div className="bg-[#181821] border border-[#262633] rounded-xl px-3 py-2">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <CheckCircle className="w-3 h-3 text-green-500/60" />
            <span>Calling from +1 910-661-0871 (verified)</span>
          </div>
        </div>

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

        {/* In-call controls row */}
        {callInProgress && (
          <div className="flex items-center justify-center gap-1.5">
            <button
              onClick={toggleMute}
              className={`p-2 rounded-xl text-xs transition flex items-center justify-center ${
                isMuted
                  ? 'bg-[#4a1a1a] border border-[#f87171] text-[#f87171]'
                  : 'bg-[#181821] border border-[#262633] text-gray-300 hover:bg-[#1f1f2b] hover:text-white'
              }`}
              title={isMuted ? 'Unmute microphone' : 'Mute microphone (M)'}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <button
              onClick={toggleHold}
              className={`p-2 rounded-xl text-xs transition flex items-center justify-center ${
                isHeld
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#181821] border border-[#262633] text-gray-300 hover:bg-[#1f1f2b] hover:text-white'
              }`}
              title={isHeld ? 'Resume call' : 'Hold call'}
            >
              {isHeld ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>

            <button
              className="p-2 rounded-xl text-xs transition bg-[#181821] border border-[#262633] text-gray-300 hover:bg-[#1f1f2b] hover:text-white"
              title="Drop voicemail"
            >
              <Mic className="w-4 h-4" />
            </button>

            <button
              className="p-2 rounded-xl text-xs transition bg-[#181821] border border-[#262633] text-gray-300 hover:bg-[#1f1f2b] hover:text-white"
              title="Skip lead"
            >
              <Play className="w-4 h-4 rotate-90" />
            </button>
          </div>
        )}

        {/* Volume sliders (mic + speaker) */}
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
              className="w-full h-1.5 bg-[#1a1a23] rounded cursor-pointer slider"
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
              className="w-full h-1.5 bg-[#1a1a23] rounded cursor-pointer slider"
              aria-label="Speaker volume"
            />
          </div>
        </div>

        {/* In-call: timer */}
        {callInProgress && (
          <div className="text-center text-xl font-bold text-white font-mono">
            {formatDuration(durationSeconds)}
          </div>
        )}

        {/* End call (active during call) */}
        {inCall && (
          <button
            onClick={handleEndCall}
            className="w-full flex items-center justify-center gap-2 bg-[#f87171] hover:bg-[#ef4444] active:bg-[#dc2626] text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition"
            title="End call"
          >
            <PhoneOff className="w-4 h-4" />
            <span>End call</span>
          </button>
        )}

        {/* Connecting/ringing status */}
        {(status === 'connecting' || status === 'ringing') && (
          <div className="flex items-center justify-center gap-2 text-yellow-400">
            <Clock className="w-4 h-4 animate-pulse" />
            <span>{message || 'Connecting...'}</span>
          </div>
        )}

        {/* Call ended */}
        {callEnded && (
          <div className="flex items-center gap-2 p-3 bg-[#1a1a23] border border-[#2a2a36] rounded-xl">
            <CheckCircle className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-300">
              Call ended.
            </span>
          </div>
        )}

        {/* Error */}
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
