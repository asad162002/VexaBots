'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { type Lead, LeadStatus } from '@/lib/types';
import { Phone, Search, Loader2, Copy, Mail, ExternalLink, MapPin, CalendarClock, X, User } from 'lucide-react';
import { useCall } from '@/components/queue/CallProvider';
import CallPanel from '@/components/queue/CallPanel';
import LeadDetails from '@/components/queue/LeadDetails';
import QueueList from '@/components/queue/QueueList';
import OutcomePanel from '@/components/queue/OutcomePanel';
import { OUTCOMES, type OutcomeOption } from '@/components/queue/outcome-types';
import { followUpLabel, followUpRank, followUpState } from '@/lib/follow-ups';

type CallPhase = 'idle' | 'ringing' | 'in-call' | 'ended';

export default function MyQueuePage() {
  // The call provider lives in the dashboard layout now, so every page shares one
  // phone line. A second one here would register a second line and ring twice.
  return <MyQueueInner />;
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
  const [queueFilter, setQueueFilter] = useState<'all' | 'google_maps' | 'linkedin' | 'manual'>('all');
  // A second axis on top of the source filter: has this caller saved an outcome yet.
  const [calledFilter, setCalledFilter] = useState<'all' | 'called' | 'not_called'>('all');
  // id -> display name for the assignee label. Admins only; a member sees only their own leads.
  const [assigneeNames, setAssigneeNames] = useState<Record<string, string>>({});

  const {
    status: callStatus,
    durationSeconds,
    callLogId,
    callInProgress,
    startCall,
    endCall,
    resetCall,
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

  /*
   * The order the caller works in. What is overdue comes first, then what is due today, then
   * the rest in the order it loaded. `sort` is stable, so nothing else is reordered by this.
   */
  const orderedQueue = useMemo(() => {
    return [...activeLeads].sort(
      (a, b) => followUpRank(a.next_follow_up_at) - followUpRank(b.next_follow_up_at)
    );
  }, [activeLeads]);

  /* Follow-ups that are owed now, soonest first, whatever the filters are. */
  const dueFollowUps = useMemo(() => {
    return orderedQueue
      .filter((l) => followUpRank(l.next_follow_up_at) < 2)
      .sort(
        (a, b) =>
          new Date(a.next_follow_up_at as string).getTime() -
          new Date(b.next_follow_up_at as string).getTime()
      );
  }, [orderedQueue]);

  /* Source and search first: the called / not-called counts read off what is on screen. */
  const visibleQueue = useMemo(() => {
    let base = orderedQueue;
    if (queueFilter === 'google_maps') base = base.filter(l => l.lead_table !== 'linkedin_leads' && l.source !== 'manual');
    else if (queueFilter === 'linkedin') base = base.filter(l => l.lead_table === 'linkedin_leads');
    else if (queueFilter === 'manual') base = base.filter(l => l.lead_table !== 'linkedin_leads' && l.source === 'manual');
    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter(l =>
      (l.title?.toLowerCase() || '').includes(q) ||
      (l.owner_name?.toLowerCase() || '').includes(q) ||
      (l.phone?.toLowerCase() || '').includes(q) ||
      (l.email?.toLowerCase() || '').includes(q) ||
      (l.linkedin_username?.toLowerCase() || '').includes(q)
    );
  }, [orderedQueue, searchQuery, queueFilter]);

  const calledCount = useMemo(
    () => visibleQueue.filter((l) => calledSet.has(l.id)).length,
    [visibleQueue, calledSet]
  );

  const filteredQueue = useMemo(() => {
    if (calledFilter === 'called') return visibleQueue.filter((l) => calledSet.has(l.id));
    if (calledFilter === 'not_called') return visibleQueue.filter((l) => !calledSet.has(l.id));
    return visibleQueue;
  }, [visibleQueue, calledFilter, calledSet]);

  const currentLead = filteredQueue[currentIndex];
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

  /*
   * What this caller has already worked, read from the database instead of from this
   * tab's memory: the called state used to live only in `calledSet`, so a reload made
   * every saved lead look uncalled and re-dialable.
   *
   * lead_activities is NOT a call log. The assignment flow writes rows here too (the
   * cold caller has 16 of them, all "Assigned to Jay"), so only activity_type = 'call'
   * counts as a call. Newest row per lead also restores the outcome label in the list.
   */
  const loadCallHistory = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('lead_activities')
        .select('lead_id, content, created_at')
        .eq('profile_id', user.id)
        .eq('activity_type', 'call')
        .order('created_at', { ascending: true });
      if (error) throw error;
      const ids = new Set<string>();
      const labels: Record<string, string> = {};
      for (const row of (data ?? []) as Array<{ lead_id: string; content: string | null }>) {
        ids.add(row.lead_id);
        if (row.content) labels[row.lead_id] = row.content;
      }
      setCalledSet(ids);
      setOutcomeMap(labels);
    } catch {
      // The queue keeps working off this session's saves rather than failing to load.
    }
  };

  useEffect(() => {
    if (authLoading) return;
    loadQueue();
  }, [authLoading, isAdmin, user]);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const [leadsRes, liRes] = await Promise.all([
        supabase.from('leads').select('*'),
        supabase.from('linkedin_leads').select('*'),
      ]);
      if (leadsRes.error) throw leadsRes.error;

      const gmapLeads = (leadsRes.data ?? []).map((l: Lead): Lead => ({ ...l, lead_table: 'leads' })).filter((l) => l.phone);
      const liLeads: Lead[] = ((liRes.data ?? []) as Array<Record<string, unknown>>)
        .filter((l) => !l.deleted_at && (l.phone as string | null))
        .map((l) => ({
          id: l.id as string,
          owner_id: null,
          title: (l.lead_name as string) || null,
          category_name: null,
          categories: null,
          phone: (l.phone as string) || null,
          address: null,
          city: null,
          postal_code: null,
          country_code: null,
          website: null,
          total_score: null,
          reviews_count: null,
          place_id: (l.place_id as string) || null,
          rank: null,
          is_advertisement: null,
          search_string: null,
          url: null,
          opening_hours: null,
          is_24_hours: null,
          permanently_closed: null,
          temporarily_closed: null,
          domain: null,
          owner_name: (l.title as string) || null,
          owner_role: null,
          owner_linkedin_url: null,
          owner_snippet: null,
          owner_found: null,
          apollo_phone: null,
          apollo_linkedin: null,
          apollo_employees: null,
          apollo_revenue: null,
          apollo_founded: null,
          apollo_description: null,
          apollo_tech_stack: null,
          apollo_keywords: null,
          running_google_ads: null,
          running_fb_ads: null,
          revenue_proxy: null,
          ad_running: null,
          no_chatbot: null,
          no_crm: null,
          no_booking_system: null,
          multi_channel_inbound: null,
          company_size_estimate: null,
          icp_score: null,
          icp_breakdown: null,
          status: 'new' as LeadStatus,
          source: 'linkedin' as const,
          notes: l.notes as string | null,
          meeting_link: null,
          source_details: null,
          last_contacted_at: null,
          // The column exists on both lead tables since 2026-11-22, so a follow-up on a
          // LinkedIn contact is a real date rather than activity history only.
          next_follow_up_at: (l.next_follow_up_at as string) || null,
          assigned_to: l.assigned_to as string | null,
          assigned_at: l.assigned_at as string | null,
          assigned_by: l.assigned_by as string | null,
          created_at: l.created_at as string,
          updated_at: l.updated_at as string,
          lead_table: 'linkedin_leads' as const,
          // Columns only linkedin_leads carries. Dropping them here is why the
          // queue's Lead details showed a contact's phone and little else.
          email: (l.email as string) || null,
          email_status: (l.email_status as string) || null,
          linkedin_url: (l.linkedin_url as string) || null,
          linkedin_username: (l.linkedin_username as string) || null,
        }));

      let merged: Lead[] = [...gmapLeads, ...liLeads];
      // Admins get every active lead (the header says "Viewing as admin"); everyone
      // else gets only what is assigned to them. Merging the two tables dropped the
      // `!isAdmin` half of this rule, which emptied the admin queue entirely.
      if (!isAdmin && user) {
        merged = merged.filter((l) => l.assigned_to === user.id);
      }
      setLeads(merged);
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
    loadCallHistory();
  }, [user]);

  /*
   * Whose lead is this. An admin's queue is every active lead in the database, so
   * without a name on the card there is no way to tell which leads are the admin's own
   * and which belong to a caller. Members only ever see their own leads, so this is
   * fetched for admins only.
   */
  const loadAssigneeNames = async () => {
    if (!isAdmin) return;
    const { data, error } = await supabase.from('profiles').select('id, full_name, email');
    if (error) return;
    const map: Record<string, string> = {};
    for (const p of (data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
      map[p.id] = p.full_name || p.email || 'Unknown member';
    }
    setAssigneeNames(map);
  };

  useEffect(() => {
    loadAssigneeNames();
  }, [isAdmin]);

  /** Full name of the assignee, or a plain word for nobody. */
  const assigneeName = (id: string | null) =>
    id ? assigneeNames[id] || 'Unknown member' : 'Unassigned';

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
    const isLinkedIn = currentLead.lead_table === 'linkedin_leads';
    /*
     * The date is saved for any outcome, not only "Call back". Before this, a caller who typed
     * a date and picked "No answer" lost it silently, because the value was only passed when the
     * outcome itself required a follow-up.
     *
     * A null here means "leave the existing date alone": the function uses `coalesce`, so an
     * outcome saved with no date no longer erases a follow-up that was already scheduled.
     * Clearing a date is its own button on the lead card.
     */
    const followUpIso = followUpDate ? new Date(`${followUpDate}T12:00:00`).toISOString() : null;
    try {
      const { error: fnError } = await supabase.rpc('log_call_outcome', {
        p_lead_id: currentLead.id,
        p_status: isLinkedIn ? null : selectedOutcome.status,
        p_notes: notes || selectedOutcome.label,
        p_follow_up_at: followUpIso,
        p_call_log_id: callLogId || null,
        p_duration_seconds: durationSeconds > 0 ? durationSeconds : null,
        p_lead_table: isLinkedIn ? 'linkedin_leads' : 'leads',
      });
      if (fnError) {
        setSaveError(fnError.message || 'Failed to save.');
        setSaving(false);
        return;
      }
      // The card and the due strip read off local state, so they follow the save rather than
      // waiting for a refetch.
      if (followUpIso) {
        setLeads((rows) =>
          rows.map((l) => (l.id === currentLead.id ? { ...l, next_follow_up_at: followUpIso } : l))
        );
      }
      setCalledSet(s => new Set([...s, currentLead.id]));
      setOutcomeMap(m => ({ ...m, [currentLead.id]: selectedOutcome.label }));
      setToast(`Saved: ${selectedOutcome.label}`);
      setTimeout(() => setToast(null), 2000);
      setSelectedOutcome(null);
      setNotes('');
      setFollowUpDate('');
      /*
       * With "Not called" on, the lead just saved leaves this list, so the lead after
       * it slides into the same index. Advancing there would skip one.
       */
      if (calledFilter === 'not_called') {
        setCurrentIndex(Math.max(0, Math.min(currentIndex, filteredQueue.length - 2)));
      } else {
        const remaining = filteredQueue.slice(currentIndex + 1);
        if (remaining.length === 0) {
          setCurrentIndex(filteredQueue.length);
        } else {
          setCurrentIndex(currentIndex + 1);
        }
      }
      // The next lead is dialed from the same panel, so the finished call is cleared
      // here and its call log id is not carried onto the next outcome.
      resetCall();
    } catch {
      setSaveError('Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Clearing a follow-up is deliberate, and it is its own function rather than a null passed to
   * the outcome save: the database writes an activity row saying the date came off, so the log
   * shows a decision rather than a date quietly disappearing.
   */
  const handleClearFollowUp = async () => {
    if (!currentLead) return;
    const { error: clearError } = await supabase.rpc('clear_lead_follow_up', {
      p_lead_id: currentLead.id,
      p_lead_table: currentLead.lead_table === 'linkedin_leads' ? 'linkedin_leads' : 'leads',
    });
    if (clearError) {
      setError(clearError.message || 'Failed to clear the follow-up date.');
      return;
    }
    setLeads((rows) =>
      rows.map((l) => (l.id === currentLead.id ? { ...l, next_follow_up_at: null } : l))
    );
    setToast('Follow-up date cleared');
    setTimeout(() => setToast(null), 2000);
  };

  /** Jump from a due follow-up to that lead, whichever filter is on. */
  const openFollowUp = (lead: Lead) => {
    const index = orderedQueue.findIndex(
      (l) => l.id === lead.id && l.lead_table === lead.lead_table
    );
    if (index < 0) return;
    setQueueFilter('all');
    setSearchQuery('');
    if (!callInProgress) resetCall();
    setCurrentIndex(index);
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
      <div className="flex items-center justify-center py-16 bg-background">
        <div className="text-muted text-sm">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center py-16 bg-background">
        <div className="text-muted text-sm">Redirecting to login...</div>
      </div>
    );
  }

  if (loading && leads.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 bg-background">
        <div className="text-muted text-sm">Loading queue...</div>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen bg-[#08090a]">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">My Queue</h1>
              {isAdmin && (
                <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded-full">
                  Viewing as admin
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <div className="h-2 flex-1 max-w-xs bg-[#191a1b] rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${activeLeads.length > 0 ? (progress / activeLeads.length) * 100 : 0}%` }}></div>
              </div>
              <p className="text-sm text-muted">{progress} of {activeLeads.length} called today</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-card border border-border rounded-lg p-0.5">
              {([
                { key: 'all', label: 'All', count: visibleQueue.length },
                { key: 'not_called', label: 'Not called', count: visibleQueue.length - calledCount },
                { key: 'called', label: 'Called', count: calledCount },
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => { setCalledFilter(opt.key); setCurrentIndex(0); }}
                  aria-pressed={calledFilter === opt.key}
                  className={`px-3 py-1.5 rounded-md text-sm transition ${
                    calledFilter === opt.key
                      ? 'bg-primary text-foreground font-medium'
                      : 'text-muted hover:text-foreground'
                  }`}
                >
                  {opt.label} ({opt.count})
                </button>
              ))}
            </div>
            <select
              value={queueFilter}
              onChange={(e) => { setQueueFilter(e.target.value as typeof queueFilter); setCurrentIndex(0); }}
              className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary [&>option]:bg-secondary [&>option]:text-foreground"
            >
              <option value="all">All Leads</option>
              <option value="google_maps">Google Maps</option>
              <option value="linkedin">LinkedIn</option>
              <option value="manual">Manual</option>
            </select>
          </div>
          </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-500/30 rounded-xl text-sm text-red-400">{error}</div>
        )}

        {toast && (
          <div className="mb-4 p-3 bg-green-900/30 border border-green-500/30 rounded-xl text-sm text-green-400">{toast}</div>
        )}

        {/*
          What is owed, above the queue rather than buried in one lead's history. A caller sees
          their own; an admin sees the set the queue is already showing them.
        */}
        {dueFollowUps.length > 0 && (
          <div className="mb-4 bg-[#0f1011] border border-yellow-500/30 rounded-xl p-3">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-yellow-400" />
                <span className="text-sm font-medium text-foreground">
                  Follow-ups due ({dueFollowUps.length})
                </span>
              </div>
              <Link href="/dashboard/follow-ups" className="text-xs text-accent hover:underline">
                See all follow-ups
              </Link>
            </div>
            <div className="space-y-1">
              {dueFollowUps.slice(0, 5).map((lead) => (
                <button
                  key={`${lead.lead_table}:${lead.id}`}
                  onClick={() => openFollowUp(lead)}
                  className="w-full flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-lg bg-[#191a1b] hover:bg-[#1f1f2b] text-left transition"
                >
                  <span className="text-xs text-foreground truncate">
                    {lead.title || lead.owner_name || 'Untitled'}
                  </span>
                  <span
                    className={`text-[11px] shrink-0 ${
                      followUpState(lead.next_follow_up_at) === 'overdue'
                        ? 'text-red-400'
                        : 'text-yellow-400'
                    }`}
                  >
                    {followUpLabel(lead.next_follow_up_at as string)}
                  </span>
                </button>
              ))}
              {dueFollowUps.length > 5 && (
                <p className="text-[11px] text-muted px-2.5 pt-1">
                  {dueFollowUps.length - 5} more on the follow-ups page.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Left: Queue */}
          <QueueList
            leads={filteredQueue}
            activeLeads={activeLeads}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            currentIndex={currentIndex}
            calledSet={calledSet}
            outcomeMap={outcomeMap}
            showAssignee={isAdmin}
            assigneeNames={assigneeNames}
            callPhase={callPhase}
            onSelect={(index) => {
              // Picking another lead by hand clears a finished call too, but never
              // interrupts one that is still running.
              if (!callInProgress) resetCall();
              setCurrentIndex(index);
            }}
          />

          {/* Center: Lead details + CallPanel */}
          <div className="flex flex-col gap-3 min-w-0">
            {currentLead ? (
              <>
                <div className="bg-[#0f1011] border border-[rgba(255,255,255,0.06)] rounded-xl p-3">
                  <div className="flex justify-between gap-8 items-start">
                    <div className="min-w-0">
                      <div className="font-medium text-foreground text-[15px]">{currentLead.title || 'Untitled Business'}</div>
                      {currentLead.owner_name && (
                        <p className="text-xs text-muted mt-1">
                          {currentLead.owner_name}
                          {currentLead.owner_role && ` · ${currentLead.owner_role}`}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-semibold bg-[#191a1b] text-yellow-400 border border-yellow-500/30">
                      {currentLead.source.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-3">
                    {isAdmin && (
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-[#191a1b] border border-[rgba(255,255,255,0.06)] ${
                          currentLead.assigned_to ? 'text-accent' : 'text-yellow-400'
                        }`}
                        title="This queue shows every lead because you are an admin"
                      >
                        <User className="w-3 h-3" />
                        {currentLead.assigned_to
                          ? currentLead.assigned_to === user?.id
                            ? 'Assigned to you'
                            : `Assigned to ${assigneeName(currentLead.assigned_to)}`
                          : 'Unassigned'}
                      </span>
                    )}
                    {currentLead.city && (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-[#191a1b] text-muted border border-[rgba(255,255,255,0.06)]">
                        📍 {currentLead.city}
                      </span>
                    )}
                    {currentLead.category_name && (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-[#191a1b] text-muted border border-[rgba(255,255,255,0.06)]">
                        🏷️ {currentLead.category_name}
                      </span>
                    )}
                    {currentLead.reviews_count && (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-[#191a1b] text-muted border border-[rgba(255,255,255,0.06)]">
                        ⭐ {currentLead.total_score} ({currentLead.reviews_count} reviews)
                      </span>
                    )}
                  </div>

                  {currentLead.next_follow_up_at && (
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border ${
                          followUpState(currentLead.next_follow_up_at) === 'overdue'
                            ? 'bg-red-500/10 text-red-400 border-red-500/30'
                            : followUpState(currentLead.next_follow_up_at) === 'today'
                              ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                              : 'bg-[#191a1b] text-muted border-[rgba(255,255,255,0.06)]'
                        }`}
                      >
                        <CalendarClock className="w-3 h-3" />
                        {followUpLabel(currentLead.next_follow_up_at)}
                      </span>
                      <button
                        onClick={handleClearFollowUp}
                        className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-foreground transition"
                        title="Clear this follow-up date"
                      >
                        <X className="w-3 h-3" />
                        Clear
                      </button>
                    </div>
                  )}

                  {(currentLead.website || currentLead.email || currentLead.linkedin_url) && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                      {currentLead.website && (
                        <a
                          href={currentLead.website.startsWith('http') ? currentLead.website : `https://${currentLead.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent"
                        >
                          {currentLead.website}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {currentLead.email && (
                        <a
                          href={`mailto:${currentLead.email}`}
                          className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent break-all"
                        >
                          <Mail className="w-3 h-3" />
                          {currentLead.email}
                        </a>
                      )}
                      {currentLead.linkedin_url && (
                        <a
                          href={currentLead.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent"
                        >
                          <ExternalLink className="w-3 h-3" />
                          LinkedIn profile
                        </a>
                      )}
                    </div>
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
              <div className="bg-[#0f1011] border border-[rgba(255,255,255,0.06)] rounded-xl p-5">
                <p className="text-sm text-muted">Select a lead from the queue.</p>
              </div>
            )}
          </div>

          {/* Right: After the Call */}
          <OutcomePanel
            outcomes={OUTCOMES}
            selectedOutcome={selectedOutcome}
            onSelectOutcome={handleSelectOutcome}
            canSelectOutcome={canSelectOutcome}
            callPhase={callPhase}
            notes={notes}
            onNotesChange={setNotes}
            followUpDate={followUpDate}
            onFollowUpDateChange={setFollowUpDate}
            saveError={saveError}
            saving={saving}
            onSave={handleSave}
          />
        </div>
      </div>
    </div>
  );
}
