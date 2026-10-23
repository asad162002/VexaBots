'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { type Lead, type LeadStatus } from '@/lib/types';
import {
  Phone,
  PhoneOff,
  Clock,
  CheckCircle,
  Search,
  Mic,
  MicOff,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useTelnyxCall } from '@/hooks/use-telnyx-call';

// Outcome mapping: numeric key -> (label, LeadStatus, optional validation)
interface OutcomeOption {
  key: number;
  label: string;
  status: LeadStatus;
  requiresFollowUp: boolean;
  shortcut: string;
}

const OUTCOMES: OutcomeOption[] = [
  { key: 1, label: 'No answer', status: 'contacted', requiresFollowUp: false, shortcut: '1' },
  { key: 2, label: 'Voicemail', status: 'contacted', requiresFollowUp: false, shortcut: '2' },
  { key: 3, label: 'Not interested', status: 'not_interested', requiresFollowUp: false, shortcut: '3' },
  { key: 4, label: 'Call back', status: 'contacted', requiresFollowUp: true, shortcut: '4' },
  { key: 5, label: 'Interested', status: 'interested', requiresFollowUp: false, shortcut: '5' },
  { key: 6, label: 'Booked meeting', status: 'meeting_booked', requiresFollowUp: false, shortcut: '6' },
  { key: 7, label: 'Wrong number', status: 'dead', requiresFollowUp: false, shortcut: '7' },
];

type CallPhase = 'idle' | 'ringing' | 'in-call';

interface MyQueuePageProps {
  initialLeads?: Lead[];
}

export default function MyQueuePage({ initialLeads }: MyQueuePageProps) {
  const { user, callerNumber, isAdmin, loading: authLoading } = useAuth();
  const [leads, setLeads] = useState<Lead[]>(initialLeads ?? []);
  const [calledSet, setCalledSet] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(!initialLeads || authLoading);
  const [error, setError] = useState<string | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<OutcomeOption | null>(null);
  const [notes, setNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Use the shared Telnyx call hook
  const {
    status: callStatus,
    message: callMessage,
    durationSeconds,
    isMuted,
    callLogId,
    startCall: hookStartCall,
    endCall: hookEndCall,
    toggleMute,
  } = useTelnyxCall();

  // Map hook status to the page's callPhase
  const callPhase: CallPhase =
    callStatus === 'connecting' || callStatus === 'ringing' ? 'ringing' :
    callStatus === 'in-call' ? 'in-call' : 'idle';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Sort: callbacks due today first, then 'new', then the rest
  const sortedLeads = [...leads].sort((a, b) => {
    const aDueToday = a.next_follow_up_at
      ? new Date(a.next_follow_up_at).setHours(0, 0, 0, 0) === today.getTime()
      : false;
    const bDueToday = b.next_follow_up_at
      ? new Date(b.next_follow_up_at).setHours(0, 0, 0, 0) === today.getTime()
      : false;
    if (aDueToday !== bDueToday) return aDueToday ? -1 : 1;
    if (a.status === 'new' && b.status !== 'new') return -1;
    if (b.status === 'new' && a.status !== 'new') return 1;

    const aFollowUp = a.next_follow_up_at ? new Date(a.next_follow_up_at).getTime() : Infinity;
    const bFollowUp = b.next_follow_up_at ? new Date(b.next_follow_up_at).getTime() : Infinity;
    if (aFollowUp !== bFollowUp) return aFollowUp - bFollowUp;
    return 0;
  });

  // Filter out terminal statuses
  const activeLeads = sortedLeads.filter(l =>
    !['not_interested', 'meeting_booked', 'dead'].includes(l.status)
  );

  // Search filter on the queue list
  const filteredQueue = searchQuery.trim()
    ? activeLeads.filter(l => {
        const q = searchQuery.toLowerCase();
        return (
          (l.title?.toLowerCase() || '').includes(q) ||
          (l.owner_name?.toLowerCase() || '').includes(q) ||
          (l.phone?.toLowerCase() || '').includes(q)
        );
      })
    : activeLeads;

  // currentLead should be based on activeLeads (not filteredQueue)
  // so that we don't skip leads when the filter hides them
  const currentLead = activeLeads[currentIndex];
  const progress = calledSet.size;

  useEffect(() => {
    if (!initialLeads && !authLoading) fetchQueue();
  }, []);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      let query = supabase.from('leads').select('*');
      if (!isAdmin && user) {
        query = query.eq('assigned_to', user.id);
      }
      const { data, error: err } = await query;
      if (err) throw err;
      setLeads(data ?? []);
    } catch {
      setError('Failed to load queue.');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startCall = async () => {
    if (!currentLead?.phone) return;
    if (!callerNumber) {
      setError('No caller number configured. Ask your admin to assign you a Telnyx caller-ID number.');
      return;
    }
    setError(null);
    await hookStartCall(currentLead.phone, currentLead.owner_name || undefined);
  };

  const endCall = () => {
    hookEndCall();
  };

  const selectOutcome = (outcome: OutcomeOption) => {
    if (callPhase !== 'idle') return;
    setSelectedOutcome(outcome);
  };

  // Save handler: uses the log_call_outcome Postgres function
  // This performs the lead update + activity insert atomically
  const handleSave = async () => {
    if (!selectedOutcome || !currentLead || saving) return;
    if (!user) return;

    if (selectedOutcome.requiresFollowUp && !followUpDate) {
      setSaveError('Follow-up date is required for "Call back"');
      return;
    }
    // Validate follow-up date: today or later (using local day, not timestamp)
    if (followUpDate) {
      const selected = new Date(followUpDate);
      selected.setHours(0, 0, 0, 0);
      if (selected < today) {
        setSaveError('Follow-up date cannot be in the past.');
        return;
      }
    }

    setSaving(true);
    setSaveError(null);

    try {
      const { data, error: fnError } = await supabase.rpc('log_call_outcome', {
        p_lead_id: currentLead.id,
        p_outcome_status: selectedOutcome.status,
        p_notes: notes || selectedOutcome.label,
        p_follow_up_at: selectedOutcome.requiresFollowUp && followUpDate
          ? new Date(followUpDate).toISOString()
          : null,
        p_call_log_id: callLogId || null,
        p_duration_seconds: durationSeconds > 0 ? durationSeconds : null,
      });

      if (fnError) {
        console.error('log_call_outcome error:', fnError);
        setSaveError(fnError.message || 'Failed to save. Check RLS permissions.');
        setSaving(false);
        return; // Do NOT advance to next lead
      }

      setCalledSet(s => new Set([...s, currentLead.id]));
      setToast(`Saved: ${selectedOutcome.label}`);
      setTimeout(() => setToast(null), 2000);

      resetCallState();
      loadNextLead();
    } catch {
      setSaveError('Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const resetCallState = () => {
    setSelectedOutcome(null);
    setNotes('');
    setFollowUpDate('');
  };

  const loadNextLead = () => {
    const remaining = activeLeads.slice(currentIndex + 1);
    setCurrentIndex(remaining.length === 0 ? activeLeads.length : currentIndex + 1);
  };

  // Keyboard shortcuts: 1-7 select outcomes, Enter saves
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (loading || saving) return;

      // Ignore shortcuts when a textarea or input is focused
      const active = document.activeElement;
      if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')) {
        return;
      }

      if (e.key >= '1' && e.key <= '7' && callPhase === 'idle') {
        e.preventDefault();
        const outcome = OUTCOMES.find(o => o.key === parseInt(e.key));
        if (outcome) selectOutcome(outcome);
      }

      if (e.key === 'Enter' && callPhase === 'idle' && selectedOutcome) {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [callPhase, selectedOutcome, notes, followUpDate, saving, loading, currentIndex]);

  const canSave = callPhase === 'idle' && selectedOutcome !== null;

  if (loading || authLoading) {
    return null;
  }

  if (currentIndex >= activeLeads.length) {
    return (
      <div className="p-6 min-h-screen bg-[#0f0f0f]">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-6">My Queue</h1>
          <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-12 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Queue Finished</h2>
            <p className="text-gray-400">All leads in your queue have been processed.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen bg-[#0f0f0f]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">My Queue</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {progress} of {activeLeads.length} called today
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      {callStatus === 'error' && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
          {callMessage}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Queue with search filter */}
        <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-4 overflow-y-auto max-h-[600px]">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Queue</h2>
          <div className="relative mb-3">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, phone..."
              className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-7 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="space-y-1">
            {filteredQueue.map((l, idx) => (
              <button
                key={l.id}
                onClick={() => {
                  if (callPhase === 'idle') setCurrentIndex(activeLeads.indexOf(l));
                }}
                disabled={callPhase !== 'idle'}
                className={`w-full text-left p-2.5 rounded-lg text-sm transition ${
                  idx === currentIndex
                    ? 'border-l-2 border-blue-500 bg-[#27272a]/30'
                    : 'hover:bg-[#27272a]/20'
                } ${calledSet.has(l.id) ? 'opacity-50' : ''}`}
              >
                <div className="font-medium text-white truncate">{l.title || 'Untitled'}</div>
                {l.owner_name && (
                  <div className="text-xs text-gray-500">{l.owner_name}</div>
                )}
                {l.phone && (
                  <div className="text-xs text-gray-400 mt-0.5">{l.phone}</div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Center: Lead Card */}
        <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-5">
          {currentLead && (
            <>
              <h2 className="text-xl font-bold text-white">
                {currentLead.title || 'Untitled Business'}
              </h2>
              {currentLead.owner_name && (
                <p className="text-sm text-gray-400 mt-1">{currentLead.owner_name}</p>
              )}

              <div className="mt-4 space-y-3">
                {currentLead.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-300">{currentLead.phone}</span>
                  </div>
                )}
                {currentLead.city && (
                  <div className="text-sm text-gray-400">📍 {currentLead.city}</div>
                )}
                {currentLead.category_name && (
                  <div className="text-sm text-gray-400">🏷️ {currentLead.category_name}</div>
                )}
                {currentLead.website && (
                  <div className="text-sm text-gray-400">🌐 {currentLead.website}</div>
                )}
                {currentLead.reviews_count && (
                  <div className="text-sm text-gray-400">
                    ⭐ {currentLead.total_score} ({currentLead.reviews_count} reviews)
                  </div>
                )}
                {currentLead.icp_score !== null && currentLead.icp_score !== undefined && (
                  <div className="text-sm text-gray-400">ICP Score: {currentLead.icp_score}</div>
                )}
              </div>

              {currentLead.notes && (
                <div className="mt-4 pt-4 border-t border-[#27272a]">
                  <h3 className="text-xs font-medium text-gray-500 uppercase mb-2">Previous Notes</h3>
                  <p className="text-sm text-gray-300 whitespace-pre-wrap break-words">
                    {currentLead.notes}
                  </p>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-[#27272a]">
                {!callerNumber && (
                  <p className="text-xs text-gray-500 mb-2">
                    No caller number configured. Ask your admin to assign you one.
                  </p>
                )}
                {callPhase === 'idle' && (
                  <button
                    onClick={startCall}
                    disabled={!callerNumber || callStatus === 'connecting'}
                    className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 active:bg-green-700 disabled:bg-gray-600 text-white font-semibold rounded-lg px-4 py-3 text-sm transition disabled:cursor-not-allowed"
                  >
                    {callStatus === 'connecting' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <>
                        <Phone className="w-4 h-4" />
                        <span>Call {currentLead.phone || 'lead'}</span>
                      </>
                    )}
                  </button>
                )}
                {(callPhase === 'ringing' || callStatus === 'connecting') && (
                  <div className="flex items-center justify-center gap-2 text-yellow-400">
                    <Clock className="w-4 h-4 animate-pulse" />
                    <span>{callMessage || 'Connecting...'}</span>
                  </div>
                )}
                {callPhase === 'in-call' && (
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
                      onClick={endCall}
                      className="p-2 rounded-lg bg-red-600 hover:bg-red-500 text-white"
                    >
                      <PhoneOff className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right: After-call panel */}
        <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-5">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            After the Call
          </h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
                Outcome (1-7 keys or click)
              </label>
              <div className="grid grid-cols-1 gap-1.5 mt-1">
                {OUTCOMES.map((outcome) => (
                  <button
                    key={outcome.key}
                    onClick={() => selectOutcome(outcome)}
                    disabled={callPhase !== 'idle'}
                    className={`text-left px-3 py-2 rounded-lg text-sm transition ${
                      selectedOutcome?.key === outcome.key
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#27272a] text-gray-300 hover:bg-[#3f3f46] hover:text-white'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <span className="font-medium">{outcome.shortcut}</span>. {outcome.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What did they say?"
                className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
                Follow-up date
              </label>
              <input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {saveError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-400">{saveError}</p>
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={!canSave || saving}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:bg-blue-800 text-white font-semibold rounded-lg px-4 py-3 text-sm transition disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Save &amp; Next</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
