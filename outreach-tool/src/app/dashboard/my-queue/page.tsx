'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { type Lead, LeadStatus } from '@/lib/types';
import { Phone, CheckCircle, Search, Loader2, Copy, Mail, ExternalLink, MapPin, Settings } from 'lucide-react';
import { useCall, CallProvider } from '@/components/queue/CallProvider';
import CallPanel from '@/components/queue/CallPanel';
import LeadDetails from '@/components/queue/LeadDetails';
import AudioSettings from '@/components/call/AudioSettings';

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

type CallPhase = 'idle' | 'ringing' | 'in-call' | 'ended';

export default function MyQueuePage() {
  return (
    <CallProvider>
      <MyQueueInner />
    </CallProvider>
  );
}

function MyQueueInner() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<OutcomeOption | null>(null);
  const [notes, setNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [calledSet, setCalledSet] = useState<Set<string>>(new Set());
  const [outcomeMap, setOutcomeMap] = useState<Record<string, string>>({});
  const [meetingMap, setMeetingMap] = useState<Record<string, { when: string; link?: string }>>({});
  const [showAudio, setShowAudio] = useState(false);

  const {
    status: callStatus,
    durationSeconds,
    callLogId,
    startCall,
    endCall,
    toggleMute,
    setVolume,
    setMicVolume,
  } = useCall();

  const callPhase: CallPhase =
    callStatus === 'connecting' || callStatus === 'ringing' ? 'ringing' :
    callStatus === 'in-call' || callStatus === 'held' ? 'in-call' :
    callStatus === 'ended' ? 'ended' : 'idle';

  const activeLeads = useMemo(() => {
    return leads.filter(l => !['not_interested', 'meeting_booked', 'dead'].includes(l.status));
  }, [leads]);

  const filteredQueue = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return activeLeads;
    return activeLeads.filter(l =>
      (l.title?.toLowerCase() || '').includes(q) ||
      (l.owner_name?.toLowerCase() || '').includes(q) ||
      (l.phone?.toLowerCase() || '').includes(q)
    );
  }, [activeLeads, searchQuery]);

  const currentLead = activeLeads[currentIndex];
  const [todayCalledIds, setTodayCalledIds] = useState<Set<string>>(new Set());

  const loadTodayProgress = async () => {
    if (!user) return;
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from('lead_activities')
        .select('lead_id')
        .eq('profile_id', user.id)
        .gte('created_at', startOfDay.toISOString());
      if (error) throw error;
      setTodayCalledIds(new Set((data ?? []).map((d: { lead_id: string }) => d.lead_id)));
    } catch {
      // ignore — fall back to in-memory state
    }
  };

  const progress = todayCalledIds.size;

  useEffect(() => {
    if (authLoading) return;
    loadQueue();
  }, [authLoading, isAdmin, user]);

  const loadQueue = async () => {
    setLoading(true);
    try {
      let query = supabase.from('leads').select('*');
      // Admins see all leads; members see their assigned leads
      if (!isAdmin && user) {
        query = query.eq('assigned_to', user.id);
      }
      const { data, error: err } = await query;
      if (err) throw err;
      setLeads(data ?? []);
      setCurrentIndex(0);
    } catch {
      setError('Failed to load queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadTodayProgress();
  }, [user]);

  const callEnded = callStatus === 'ended';
  const canSelectOutcome = callEnded || !!meetingMap[currentLead?.id || ''];

  const handleSelectOutcome = (outcome: OutcomeOption) => {
    if (!canSelectOutcome) return;
    setSelectedOutcome(outcome);
  };

  const handleCallEnd = () => {
    loadTodayProgress();
  };

  const handleMeetingBooked = (booking: {
    date: string;
    time: string;
    timezone: string;
    link: string;
  }) => {
    if (!currentLead) return;
    const when = `${booking.date} ${booking.time} (${booking.timezone})`;
    setMeetingMap(m => ({ ...m, [currentLead.id]: { when, link: booking.link } }));
    setOutcomeMap(m => ({ ...m, [currentLead.id]: 'Booked meeting' }));
    setSelectedOutcome(OUTCOMES.find(o => o.status === 'meeting_booked') || null);
    setToast(`Meeting booked for ${when}`);
    setTimeout(() => setToast(null), 2000);
  };

  const handleSave = async () => {
    if (!selectedOutcome || !currentLead || saving || !canSelectOutcome) return;

    // "Call back" requires a follow-up date
    if (selectedOutcome.requiresFollowUp && !followUpDate) {
      setSaveError('Please select a follow-up date.');
      return;
    }

    // Reject dates before today (local calendar day comparison)
    if (followUpDate) {
      const today = new Date().toISOString().split('T')[0];
      if (followUpDate < today) {
        setSaveError('Follow-up date cannot be before today.');
        return;
      }
    }

    setSaving(true);
    setSaveError(null);
    try {
      const { error: fnError } = await supabase.rpc('log_call_outcome', {
        p_lead_id: currentLead.id,
        p_status: selectedOutcome.status,
        p_notes: notes || selectedOutcome.label,
        p_follow_up_at:
          selectedOutcome.requiresFollowUp && followUpDate
            ? new Date(`${followUpDate}T12:00:00`).toISOString()
            : null,
        p_call_log_id: callLogId || null,
        p_duration_seconds: durationSeconds > 0 ? durationSeconds : null,
      });
      if (fnError) {
        setSaveError(fnError.message || 'Failed to save.');
        setSaving(false);
        return;
      }
      setCalledSet(s => new Set([...s, currentLead.id]));
      setOutcomeMap(m => ({ ...m, [currentLead.id]: selectedOutcome.label }));
      setToast(`Saved: ${selectedOutcome.label}`);
      setTimeout(() => setToast(null), 2000);
      setSelectedOutcome(null);
      setNotes('');
      setFollowUpDate('');
      const remaining = activeLeads.slice(currentIndex + 1);
      if (remaining.length === 0) {
        setCurrentIndex(activeLeads.length);
      } else {
        setCurrentIndex(currentIndex + 1);
      }
    } catch {
      setSaveError('Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (authLoading || saving) return;
      const active = document.activeElement;
      if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')) {
        return;
      }
      if (e.key >= '1' && e.key <= '7' && canSelectOutcome) {
        e.preventDefault();
        const outcome = OUTCOMES.find(o => o.key === parseInt(e.key));
        if (outcome) handleSelectOutcome(outcome);
      }
      if (e.key.toLowerCase() === 'm' && (callPhase === 'ringing' || callPhase === 'in-call')) {
        e.preventDefault();
        toggleMute();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [callPhase, canSelectOutcome, currentLead, saving, authLoading, toggleMute]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-16 bg-[#0f0f0f]">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center py-16 bg-[#0f0f0f]">
        <div className="text-gray-400 text-sm">Redirecting to login...</div>
      </div>
    );
  }

  if (loading && leads.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 bg-[#0f0f0f]">
        <div className="text-gray-400 text-sm">Loading queue...</div>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen bg-[#0b0b0f]">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">My Queue</h1>
              {isAdmin && (
                <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded-full">
                  Viewing as admin
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <div className="h-2 flex-1 max-w-xs bg-[#1d1d28] rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${activeLeads.length > 0 ? (progress / activeLeads.length) * 100 : 0}%` }}></div>
              </div>
              <p className="text-sm text-gray-500">{progress} of {activeLeads.length} called today</p>
            </div>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowAudio(!showAudio)}
              className="p-2 rounded-xl bg-[#181821] border border-[#262633] text-gray-400 hover:text-white hover:bg-[#1f1f2b] transition"
              aria-label="Queue settings"
              title="Queue settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            {showAudio && (
              <div className="absolute right-0 bottom-full mb-2 w-64 bg-[#1a1a1a] border border-[#27272a] rounded-lg shadow-xl p-4 z-50">
                <AudioSettings />
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-500/30 rounded-xl text-sm text-red-400">{error}</div>
        )}

        {toast && (
          <div className="mb-4 p-3 bg-green-900/30 border border-green-500/30 rounded-xl text-sm text-green-400">{toast}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Left: Queue */}
          <div className="bg-[#13131a] border border-[#23232e] rounded-xl p-3 overflow-y-auto max-h-[600px]">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Queue · {activeLeads.length}</p>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name or phone"
                className="w-full bg-[#181821] border border-[#262633] rounded-xl text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 h-9 pl-10 pr-3 text-sm"
                aria-label="Search leads"
              />
            </div>
            <div className="space-y-1">
              {filteredQueue.map((l) => {
                const originalIndex = activeLeads.findIndex(a => a.id === l.id);
                const isDone = calledSet.has(l.id);
                const outcomeLabel = outcomeMap[l.id];
                const initials = (l.owner_name || l.title || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
                return (
                  <button
                    key={l.id}
                    onClick={() => {
                      if (callPhase === 'idle') {
                        setCurrentIndex(originalIndex);
                      }
                    }}
                    disabled={callPhase !== 'idle'}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition ${
                      originalIndex === currentIndex
                        ? 'bg-[#1b2236] border border-[#2c3a66]'
                        : 'hover:bg-[#1a1a23]'
                    } ${isDone ? 'opacity-60' : ''}`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-medium flex-shrink-0 ${
                      originalIndex === currentIndex ? 'bg-blue-600 text-white' : 'bg-[#232333] text-gray-400'
                    }`}>
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-white text-sm truncate">{l.title || 'Untitled'}</div>
                      <div className="text-xs text-gray-500 truncate">{l.owner_name || ''} · {l.phone || ''}</div>
                    </div>
                    {isDone && outcomeLabel && (
                      <span className="text-xs text-green-400">{outcomeLabel}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Center: Lead details + CallPanel */}
          <div className="flex flex-col gap-3 min-w-0">
            {currentLead ? (
              <>
                <div className="bg-[#13131a] border border-[#23232e] rounded-xl p-3">
                  <div className="flex justify-between gap-8 items-start">
                    <div className="min-w-0">
                      <div className="font-medium text-white text-[15px]">{currentLead.title || 'Untitled Business'}</div>
                      {currentLead.owner_name && (
                        <p className="text-xs text-gray-500 mt-1">
                          {currentLead.owner_name}
                          {currentLead.owner_role && ` — ${currentLead.owner_role}`}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-semibold bg-[#2a2410] text-yellow-400 border border-yellow-500/30">
                      {currentLead.source.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-3">
                    {currentLead.city && (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-[#1d1d28] text-gray-400 border border-[#2b2b3a]">
                        📍 {currentLead.city}
                      </span>
                    )}
                    {currentLead.category_name && (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-[#1d1d28] text-gray-400 border border-[#2b2b3a]">
                        🏷️ {currentLead.category_name}
                      </span>
                    )}
                    {currentLead.reviews_count && (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-[#1d1d28] text-gray-400 border border-[#2b2b3a]">
                        ⭐ {currentLead.total_score} ({currentLead.reviews_count} reviews)
                      </span>
                    )}
                  </div>

                  {currentLead.website && (
                    <a
                      href={currentLead.website.startsWith('http') ? currentLead.website : `https://${currentLead.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-2"
                    >
                      {currentLead.website}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <CallPanel
                  lead={currentLead}
                  onCallEnd={handleCallEnd}
                  onMeetingBooked={handleMeetingBooked}
                />

                {meetingMap[currentLead.id] && (
                  <div className="mt-2 p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-sm text-green-400 flex items-center justify-between">
                    <span>✓ Meeting booked: {meetingMap[currentLead.id].when}</span>
                    {meetingMap[currentLead.id].link && (
                      <a
                        href={meetingMap[currentLead.id].link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-xs text-green-300 underline"
                      >
                        Open booking
                      </a>
                    )}
                  </div>
                )}

                <LeadDetails lead={currentLead} />
              </>
            ) : (
              <div className="bg-[#13131a] border border-[#23232e] rounded-xl p-5">
                <p className="text-sm text-gray-400">Select a lead from the queue.</p>
              </div>
            )}
          </div>

          {/* Right: After the Call */}
          <div className="bg-[#13131a] border border-[#23232e] rounded-xl p-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">After the call</p>
            <div className="space-y-3">
              {!canSelectOutcome && callPhase !== 'ended' && (
                <div className="text-xs text-yellow-400 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                  End the call to select an outcome, or book a meeting.
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
                  Outcome (1-7 keys or click)
                </label>
                <div className="grid grid-cols-1 gap-1.5 mt-2">
                  {OUTCOMES.map((outcome) => (
                    <button
                      key={outcome.key}
                      onClick={() => handleSelectOutcome(outcome)}
                      disabled={!canSelectOutcome}
                      className={`oc text-left px-3 py-2 rounded-xl text-sm transition ${
                        selectedOutcome?.key === outcome.key
                          ? 'border border-[#383835] bg-[#1b1b27] text-white'
                          : 'bg-[#181821] text-gray-300 border border-[#262633] hover:bg-[#1f1f2b] hover:text-white'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <span className="flex items-center justify-between">
                        <span>{outcome.label}</span>
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-[#0f0f15] border border-[#2b2b3a] text-gray-500 font-mono">
                          {outcome.shortcut}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What did they say?"
                  className="w-full bg-[#181821] border border-[#262633] rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Follow-up date</label>
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full bg-[#181821] border border-[#262633] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {saveError && (
                <div className="p-3 bg-red-900/30 border border-red-500/30 rounded-xl">
                  <p className="text-sm text-red-400">{saveError}</p>
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={!selectedOutcome || saving || !canSelectOutcome}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:bg-blue-800 text-white font-semibold rounded-xl px-4 py-3 text-sm transition disabled:cursor-not-allowed"
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
        </div>
      </div>
    </div>
  );
}
