'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { type Lead, LeadStatus } from '@/lib/types';
import { Phone, Search, Loader2, Copy, Mail, ExternalLink, MapPin } from 'lucide-react';
import { useCall, CallProvider } from '@/components/queue/CallProvider';
import CallPanel from '@/components/queue/CallPanel';
import LeadDetails from '@/components/queue/LeadDetails';
import QueueList from '@/components/queue/QueueList';
import OutcomePanel from '@/components/queue/OutcomePanel';
import { OUTCOMES, type OutcomeOption } from '@/components/queue/outcome-types';

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
  const [queueFilter, setQueueFilter] = useState<'all' | 'google_maps' | 'linkedin' | 'manual'>('all');

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
    let base = activeLeads;
    if (queueFilter === 'google_maps') base = base.filter(l => l.lead_table !== 'linkedin_leads' && l.source !== 'manual');
    else if (queueFilter === 'linkedin') base = base.filter(l => l.lead_table === 'linkedin_leads');
    else if (queueFilter === 'manual') base = base.filter(l => l.lead_table !== 'linkedin_leads' && l.source === 'manual');
    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter(l =>
      (l.title?.toLowerCase() || '').includes(q) ||
      (l.owner_name?.toLowerCase() || '').includes(q) ||
      (l.phone?.toLowerCase() || '').includes(q)
    );
  }, [activeLeads, searchQuery, queueFilter]);

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
          next_follow_up_at: null,
          assigned_to: l.assigned_to as string | null,
          assigned_at: l.assigned_at as string | null,
          assigned_by: l.assigned_by as string | null,
          created_at: l.created_at as string,
          updated_at: l.updated_at as string,
          lead_table: 'linkedin_leads' as const,
        }));

      let merged: Lead[] = [...gmapLeads, ...liLeads];
      if (user) {
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
    const isLinkedIn = currentLead.lead_table === 'linkedin_leads';
    try {
      const { error: fnError } = await supabase.rpc('log_call_outcome', {
        p_lead_id: currentLead.id,
        p_status: isLinkedIn ? null : selectedOutcome.status,
        p_notes: notes || selectedOutcome.label,
        p_follow_up_at:
          selectedOutcome.requiresFollowUp && followUpDate
            ? new Date(`${followUpDate}T12:00:00`).toISOString()
            : null,
        p_call_log_id: callLogId || null,
        p_duration_seconds: durationSeconds > 0 ? durationSeconds : null,
        p_lead_table: isLinkedIn ? 'linkedin_leads' : 'leads',
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
      const remaining = filteredQueue.slice(currentIndex + 1);
      if (remaining.length === 0) {
        setCurrentIndex(filteredQueue.length);
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
          <select
            value={queueFilter}
            onChange={(e) => { setQueueFilter(e.target.value as typeof queueFilter); setCurrentIndex(0); }}
            className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Leads</option>
            <option value="google_maps">Google Maps</option>
            <option value="linkedin">LinkedIn</option>
            <option value="manual">Manual</option>
          </select>
          </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-500/30 rounded-xl text-sm text-red-400">{error}</div>
        )}

        {toast && (
          <div className="mb-4 p-3 bg-green-900/30 border border-green-500/30 rounded-xl text-sm text-green-400">{toast}</div>
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
            callPhase={callPhase}
            onSelect={setCurrentIndex}
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
                          {currentLead.owner_role && ` — ${currentLead.owner_role}`}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-semibold bg-[#191a1b] text-yellow-400 border border-yellow-500/30">
                      {currentLead.source.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-3">
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

                  {currentLead.website && (
                    <a
                      href={currentLead.website.startsWith('http') ? currentLead.website : `https://${currentLead.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent mt-2"
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
