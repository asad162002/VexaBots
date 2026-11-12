'use client';

import { CheckCircle, Loader2 } from 'lucide-react';
import type { OutcomeOption } from '@/components/queue/outcome-types';

interface OutcomePanelProps {
  outcomes: OutcomeOption[];
  selectedOutcome: OutcomeOption | null;
  onSelectOutcome: (o: OutcomeOption) => void;
  canSelectOutcome: boolean;
  callPhase: string;
  notes: string;
  onNotesChange: (v: string) => void;
  followUpDate: string;
  onFollowUpDateChange: (v: string) => void;
  saveError: string | null;
  saving: boolean;
  onSave: () => void;
}

export default function OutcomePanel({
  outcomes,
  selectedOutcome,
  onSelectOutcome,
  canSelectOutcome,
  callPhase,
  notes,
  onNotesChange,
  followUpDate,
  onFollowUpDateChange,
  saveError,
  saving,
  onSave,
}: OutcomePanelProps) {
  return (
    <div className="bg-[#0f1011] border border-[rgba(255,255,255,0.06)] rounded-xl p-3">
      <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">After the call</p>
      <div className="space-y-3">
        {!canSelectOutcome && callPhase !== 'ended' && (
          <div className="text-xs text-yellow-400 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
            End the call to select an outcome, or book a meeting.
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-muted mb-1 uppercase tracking-wide">
            Outcome (1-7 keys or click)
          </label>
          <div className="grid grid-cols-1 gap-1.5 mt-2">
            {outcomes.map((outcome) => (
              <button
                key={outcome.key}
                onClick={() => onSelectOutcome(outcome)}
                disabled={!canSelectOutcome}
                className={`oc text-left px-3 py-2 rounded-xl text-sm transition ${
                  selectedOutcome?.key === outcome.key
                    ? 'border border-[rgba(255,255,255,0.08)] bg-[#1b1b27] text-foreground'
                    : 'bg-secondary text-muted border border-border hover:bg-[#1f1f2b] hover:text-foreground'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <span className="flex items-center justify-between">
                  <span>{outcome.label}</span>
                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-[#0f0f15] border border-[rgba(255,255,255,0.06)] text-muted font-mono">
                    {outcome.shortcut}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted mb-1 uppercase tracking-wide">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="What did they say?"
            className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder-muted focus:outline-none focus:ring-1 focus:ring-primary resize-y"
            rows={3}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted mb-1 uppercase tracking-wide">Follow-up date</label>
          <input
            type="date"
            value={followUpDate}
            onChange={(e) => onFollowUpDateChange(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {saveError && (
          <div className="p-3 bg-red-900/30 border border-red-500/30 rounded-xl">
            <p className="text-sm text-red-400">{saveError}</p>
          </div>
        )}

        <button
          onClick={onSave}
          disabled={!selectedOutcome || saving || !canSelectOutcome}
          className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary active:bg-accent disabled:bg-primary text-foreground font-semibold rounded-xl px-4 py-3 text-sm transition disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4" />
              <span>Save and next</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
