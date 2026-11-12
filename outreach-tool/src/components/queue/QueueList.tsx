'use client';

import { Search } from 'lucide-react';
import type { Lead } from '@/lib/types';

interface QueueListProps {
  leads: Lead[];
  activeLeads: Lead[];
  searchQuery: string;
  onSearchChange: (v: string) => void;
  currentIndex: number;
  calledSet: Set<string>;
  outcomeMap: Record<string, string>;
  callPhase: string;
  onSelect: (index: number) => void;
}

export default function QueueList({
  leads,
  activeLeads,
  searchQuery,
  onSearchChange,
  currentIndex,
  calledSet,
  outcomeMap,
  callPhase,
  onSelect,
}: QueueListProps) {
  return (
    <div className="bg-[#0f1011] border border-[rgba(255,255,255,0.06)] rounded-xl p-3 overflow-y-auto max-h-[600px]">
      <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Queue · {activeLeads.length}</p>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search name or phone"
          className="w-full bg-secondary border border-border rounded-xl text-muted placeholder-muted focus:outline-none focus:ring-1 focus:ring-primary h-9 pl-10 pr-3 text-sm"
          aria-label="Search leads"
        />
      </div>
      <div className="space-y-1">
        {leads.map((l) => {
          const originalIndex = activeLeads.findIndex(a => a.id === l.id);
          const isDone = calledSet.has(l.id);
          const outcomeLabel = outcomeMap[l.id];
          const initials = (l.owner_name || l.title || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
          return (
            <button
              key={l.id}
              onClick={() => {
                if (callPhase === 'idle') {
                  onSelect(originalIndex);
                }
              }}
              disabled={callPhase !== 'idle'}
              className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition ${
                originalIndex === currentIndex
                  ? 'bg-[#191a1b] border border-[rgba(255,255,255,0.08)]'
                  : 'hover:bg-[#191a1b]'
              } ${isDone ? 'opacity-60' : ''}`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-medium flex-shrink-0 ${
                originalIndex === currentIndex ? 'bg-primary text-foreground' : 'bg-[#191a1b] text-muted'
              }`}>
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-foreground text-sm truncate">{l.title || 'Untitled'}</div>
                <div className="text-xs text-muted truncate">{l.owner_name || ''} · {l.phone || ''}</div>
              </div>
              {isDone && outcomeLabel && (
                <span className="text-xs text-green-400">{outcomeLabel}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
