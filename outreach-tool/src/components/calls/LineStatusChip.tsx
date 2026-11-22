'use client';

import { PhoneCall, RefreshCw } from 'lucide-react';
import { useCall } from '@/components/queue/CallProvider';

// The state of this rep's phone line, shown in the sidebar on every dashboard page.
//
// A callback can only reach a browser while that browser holds a registration with
// Telnyx: a credentials-based connection refuses the call at the SIP layer otherwise,
// and the caller just hears it fail. That is invisible from inside the app, so the line
// reports itself here, and can be reopened with one click instead of a page reload.
export default function LineStatusChip() {
  const { lineStatus, callInProgress, reconnectLine } = useCall();

  const onCall = callInProgress;
  const dot = onCall ? '#f59e0b' : lineStatus === 'ready' ? '#22c55e' : lineStatus === 'connecting' ? '#f59e0b' : '#ef4444';
  const label = onCall
    ? 'Line on a call'
    : lineStatus === 'ready'
    ? 'Line ready'
    : lineStatus === 'connecting'
    ? 'Opening line...'
    : 'Line offline';

  return (
    <div className="pb-2">
      <div
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-md"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
      >
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dot }} />
        <PhoneCall className="w-3.5 h-3.5 shrink-0" style={{ color: dot }} />
        <span className="text-[11px] flex-1 truncate" style={{ color: '#8a8f98' }}>
          {label}
        </span>
        {lineStatus === 'offline' && !onCall && (
          <button
            onClick={reconnectLine}
            title="Open the line again"
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition"
            style={{ background: 'rgba(94,106,210,0.15)', color: '#7170ff' }}
          >
            <RefreshCw className="w-3 h-3" />
            Fix
          </button>
        )}
      </div>
    </div>
  );
}
