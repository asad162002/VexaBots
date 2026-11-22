'use client';

import { Phone, PhoneOff, Mic, MicOff, PhoneIncoming } from 'lucide-react';
import { useCall } from '@/components/queue/CallProvider';

// A call arriving on the shared number.
//
// Mounted once in the dashboard layout so it is available on every page: a callback
// does not care whether the rep is looking at My Queue, Leads or Settings. The call
// panel inside My Queue shows the same state through the same hook, so this is not a
// second implementation, just a second view of one phone line.
export default function IncomingCallBanner() {
  const {
    incoming,
    inboundActive,
    status,
    isMuted,
    durationSeconds,
    answerIncoming,
    rejectIncoming,
    endCall,
    toggleMute,
  } = useCall();

  const answered = inboundActive && (status === 'in-call' || status === 'held');

  if (!incoming && !answered) return null;

  const clock = `${Math.floor(durationSeconds / 60)}:${String(durationSeconds % 60).padStart(2, '0')}`;
  const headline = incoming?.leadName || incoming?.from || 'Unknown number';

  return (
    <div
      className="fixed bottom-6 right-6 z-50 w-[340px] rounded-xl border shadow-2xl"
      style={{
        background: '#13131a',
        borderColor: answered ? 'rgba(34,197,94,0.35)' : 'rgba(113,112,255,0.35)',
      }}
    >
      <div className="flex items-center gap-2 px-4 pt-3">
        <span
          className="w-2 h-2 rounded-full"
          style={{ background: answered ? '#22c55e' : '#7170ff' }}
        />
        <span className="text-[11px] uppercase tracking-wide" style={{ color: answered ? '#22c55e' : '#7170ff' }}>
          {answered ? `Inbound call ${clock}` : 'Incoming call'}
        </span>
      </div>

      <div className="px-4 pt-2 pb-3">
        <p className="text-base font-semibold truncate" style={{ color: '#e6e8eb' }}>
          {headline}
        </p>
        {incoming?.leadName && (
          <p className="text-xs mt-0.5" style={{ color: '#8a8f98' }}>{incoming.from}</p>
        )}
        {incoming?.lastCallerName && (
          <p className="text-xs mt-1" style={{ color: '#8a8f98' }}>
            Last called by {incoming.lastCallerName}
          </p>
        )}
        {!incoming?.lastCallerName && incoming?.ownerName && (
          <p className="text-xs mt-1" style={{ color: '#8a8f98' }}>
            Owner: {incoming.ownerName}
          </p>
        )}
      </div>

      <div className="flex gap-2 px-4 pb-4">
        {answered ? (
          <>
            <button
              onClick={toggleMute}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium border transition"
              style={{ color: '#d0d6e0', borderColor: '#2a2a36', background: '#1a1a23' }}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              {isMuted ? 'Unmute' : 'Mute'}
            </button>
            <button
              onClick={endCall}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition"
              style={{ background: '#dc2626', color: '#ffffff' }}
            >
              <PhoneOff className="w-4 h-4" />
              End call
            </button>
          </>
        ) : (
          <>
            <button
              onClick={rejectIncoming}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium border transition"
              style={{ color: '#d0d6e0', borderColor: '#2a2a36', background: '#1a1a23' }}
            >
              <PhoneOff className="w-4 h-4" />
              Reject
            </button>
            <button
              onClick={answerIncoming}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition"
              style={{ background: '#16a34a', color: '#ffffff' }}
            >
              <Phone className="w-4 h-4" />
              Answer
            </button>
          </>
        )}
      </div>
    </div>
  );
}
