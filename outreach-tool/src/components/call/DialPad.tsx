'use client';

// A 12-key dial pad for the live call.
//
// The phone line can send digits (call.dtmf in @telnyx/webrtc) but a caller had no
// way to reach it, so an auto-attendant asking to "press 1 for sales" was a dead end.
// This pad reports the pressed key upward and holds no state of its own: the caller
// owns the last-sent digit, so there is one source of truth and no stale closure.

interface DialPadProps {
  onDigit: (digit: string) => void;
  /** Last digit sent, shown as feedback under the pad. */
  lastDigit?: string | null;
  disabled?: boolean;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

export default function DialPad({ onDigit, lastDigit, disabled = false }: DialPadProps) {
  return (
    <div className="bg-secondary border border-border rounded-xl p-2">
      <div className="grid grid-cols-3 gap-1.5">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => onDigit(key)}
            aria-label={`Send ${key}`}
            className="min-h-[40px] rounded-lg bg-card border border-border text-foreground text-sm font-semibold hover:bg-[#1f1f2b] active:bg-primary disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {key}
          </button>
        ))}
      </div>
      <div className="mt-1.5 h-3 text-center text-[10px] text-muted font-mono">
        {lastDigit ? `sent ${lastDigit}` : ''}
      </div>
    </div>
  );
}
