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
  const { callerNumber, user } = useAuth();
  const [callEnded, setCallEnded] = useState(false);

  const {
    status,
    message,
    durationSeconds,
    isMuted,
    callLogId,
    startCall,
    endCall,
    toggleMute,
  } = useTelnyxCall();

  const isCalling = status === 'connecting' || status === 'ringing' || status === 'in-call';
  const inCall = status === 'ringing' || status === 'in-call';

  const handleStartCall = () => {
    if (!lead?.phone) return;
    startCall(lead.phone, lead.owner_name || undefined);
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
        from_number: callerNumber || '',
        to_number: lead?.phone || '',
        status: 'disconnected',
        duration_seconds: durationSeconds,
        recorded_url: null,
        recording_url: null,
        call_id: null,
        started_at: null,
        ended_at: new Date().toISOString(),
        call_control_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }, [status, callEnded, callLogId, durationSeconds, callerNumber, lead, user, onCallEnd]);

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

        {!callerNumber ? (
          <p className="text-xs text-gray-500">
            No caller number configured for your account. Ask your admin to assign you a Telnyx caller-ID number.
          </p>
        ) : (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <CheckCircle className="w-3 h-3 text-green-500/60" />
            <span>Calling from {callerNumber}</span>
          </div>
        )}

        {!inCall && !callEnded && callerNumber && (
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
          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-2 text-gray-300 font-mono">
              <Clock className="w-4 h-4" />
              {formatDuration(durationSeconds)}
            </div>
            <button
              onClick={toggleMute}
              className={`p-2 rounded-lg transition ${
                isMuted
                  ? 'bg-red-600 text-white'
                  : 'bg-[#27272a] text-gray-300 hover:bg-[#3f3f46]'
              }`}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <button
              onClick={handleEndCall}
              className="p-2 rounded-lg bg-red-600 hover:bg-red-500 text-white transition"
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
