'use client';

import { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase';
import { type Lead, type LeadStatus, type Profile } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Spinner from '@/components/ui/spinner';
import CallDialer from '@/components/CallDialer';
import { CallProvider } from '@/components/queue/CallProvider';
import LeadHeader from '@/components/leads/LeadHeader';
import LeadUpdatePanel from '@/components/leads/LeadUpdatePanel';
import LeadQuickInfo from '@/components/leads/LeadQuickInfo';
import LeadAddressInfo from '@/components/leads/LeadAddressInfo';
import LeadCompetitorInfo from '@/components/leads/LeadCompetitorInfo';
import LeadOwnerInfo from '@/components/leads/LeadOwnerInfo';
import LeadAdSignals from '@/components/leads/LeadAdSignals';
import CalComModal from '@/components/leads/CalComModal';
import ActivityLog from '@/components/leads/ActivityLog';

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <CallProvider>
      <LeadDetailInner params={params} />
    </CallProvider>
  );
}

function LeadDetailInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const [status, setStatus] = useState<LeadStatus>('new');
  const [assignedTo, setAssignedTo] = useState<string>('');

  // Activity log state
  const [activities, setActivities] = useState<any[]>([]);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [showBookMeeting, setShowBookMeeting] = useState(false);
  const [activityType, setActivityType] = useState('call');
  const [activityContent, setActivityContent] = useState('');
  const [activityOutcome, setActivityOutcome] = useState('');
  const [activityFollowUp, setActivityFollowUp] = useState('');

  useEffect(() => {
    fetchLead();
    if (user) {
      fetchProfiles();
    }
  }, [id, user]);

  const fetchProfiles = async () => {
    const { data, error: profilesError } = await supabase.from('profiles').select('*');
    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
    } else {
      setProfiles(data ?? []);
    }
  };

  const fetchLead = async () => {
    const { data, error: fetchError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching lead:', fetchError);
      setError('Lead not found or you do not have access.');
      setLoading(false);
      return;
    }

    setLead(data);
    setStatus(data.status);
    setAssignedTo(data.assigned_to ?? '');
    fetchActivities();
    setLoading(false);
  };

  const fetchActivities = async () => {
    const { data, error: activitiesError } = await supabase
      .from('lead_activities')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: false });

    if (activitiesError) {
      console.error('Error fetching activities:', activitiesError);
    } else {
      setActivities(data ?? []);
    }
  };

  const handleLogActivity = async () => {
    if (!user || !activityContent.trim()) return;

    // Validate follow-up date is not in the past
    if (activityFollowUp && new Date(activityFollowUp) < new Date(new Date().setHours(0, 0, 0, 0))) {
      setError('Follow-up date cannot be in the past.');
      return;
    }

    const { error: insertError } = await supabase.from('lead_activities').insert({
      lead_id: id,
      profile_id: user.id,
      activity_type: activityType,
      content: activityContent.trim(),
      outcome: activityOutcome.trim() || null,
      next_follow_up_at: activityFollowUp
        ? new Date(activityFollowUp).toISOString()
        : null,
    });

    if (insertError) {
      console.error('Error logging activity:', insertError);
      setError('Failed to log activity.');
      return;
    }

    // Reset form
    setActivityType('call');
    setActivityContent('');
    setActivityOutcome('');
    setActivityFollowUp('');
    setShowActivityForm(false);

    // Refresh activities
    fetchActivities();

    // Also update the lead's notes and next_follow_up_at if activity has follow-up
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (activityFollowUp) {
      updates.next_follow_up_at = new Date(activityFollowUp).toISOString();
    }
    // Append activity note to lead notes
    if (activityContent && !activityFollowUp) {
      updates.notes = lead?.notes
        ? `${lead.notes}\n\n[${activityType}] ${activityContent}`
        : `[${activityType}] ${activityContent}`;
    }
    await supabase.from('leads').update(updates).eq('id', id);
    fetchLead();
  };

  const handleSave = async () => {
    if (!lead) return;

    setSaving(true);
    setError('');

    const updates: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
      meeting_link: lead.meeting_link || null,
    };

    if (!lead.owner_id && user) {
      updates.owner_id = user.id;
    }

    if (status !== 'new' && status !== lead.status) {
      updates.last_contacted_at = new Date().toISOString();
    }

    // Log status change to history
    if (status !== lead.status) {
      await supabase.from('lead_status_history').insert({
        lead_id: id,
        profile_id: user?.id || null,
        old_status: lead.status,
        new_status: status,
        reason: null,
      });
    }

    if (assignedTo) {
      updates.assigned_to = assignedTo;
      const previousAssignee = lead.assigned_to;

      if (!lead.assigned_to) {
        updates.assigned_at = new Date().toISOString();
        updates.assigned_by = user?.id || null;
      }

      if (assignedTo !== previousAssignee) {
        await supabase.from('assignment_history').insert({
          lead_id: id,
          assigned_to: assignedTo,
          assigned_by: user?.id || null,
          assigned_at: new Date().toISOString(),
          previous_assignee: previousAssignee,
          notes: lead?.notes || null,
        });
      }
    } else {
      updates.assigned_to = null;
      updates.assigned_at = null;
      updates.assigned_by = null;
    }

    const { error: updateError } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', id);

    if (updateError) {
      setError('Failed to save changes. Please try again.');
      setSaving(false);
      return;
    }

    fetchLead();
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 bg-[#0f0f0f]">
        <div className="flex items-center gap-3 text-gray-400">
          <Spinner size="md" />
          <span>Loading lead...</span>
        </div>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="bg-[#1a1a1a] border border-[#27272b] rounded-xl p-12 text-center bg-[#0f0f0f]">
        <p className="text-red-400 mb-3">{error || 'Lead not found'}</p>
        <button
          onClick={() => router.push('/dashboard')}
          className="text-blue-400 hover:text-blue-300 font-medium text-sm"
        >
          Back to leads
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Back button */}
      <button
        onClick={() => router.push('/dashboard')}
        className="mb-5 text-sm text-gray-500 hover:text-white transition flex items-center gap-1.5"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to leads
      </button>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: main info + dialer */}
        <div className="lg:col-span-2 space-y-5">
          <LeadHeader
            lead={lead}
            status={status}
            setStatus={setStatus}
            assignedTo={assignedTo}
            setAssignedTo={setAssignedTo}
            profiles={profiles}
            onSave={handleSave}
            saving={saving}
            onBookMeeting={() => setShowBookMeeting(true)}
          />

          {/* Call Dialer */}
          {lead.phone && (
            <div className="mt-6">
              <CallDialer
                lead={lead}
              />
            </div>
          )}

          {/* Cal.com Booking Modal */}
          <CalComModal
            lead={lead}
            show={showBookMeeting}
            onClose={() => setShowBookMeeting(false)}
          />

          {/* Quick Info */}
          <LeadQuickInfo lead={lead} />

          {/* Address / Opening Hours */}
          <LeadAddressInfo lead={lead} />

          {/* Competitors */}
          <LeadCompetitorInfo lead={lead} />

          {/* Owner / Contact */}
          <LeadOwnerInfo lead={lead} />

          {/* Ad & Enrichment Data */}
          <LeadAdSignals lead={lead} />
        </div>

        {/* Right column: update panel */}
        <div className="lg:col-span-1">
          <LeadUpdatePanel
            lead={lead}
            status={status}
            setStatus={setStatus}
            assignedTo={assignedTo}
            setAssignedTo={setAssignedTo}
            profiles={profiles}
            onSave={handleSave}
            saving={saving}
          />
        </div>

        {/* Activity Log */}
        <div className="lg:col-span-2 mt-6">
          <ActivityLog
            leadId={id}
            activities={activities}
            profiles={profiles}
            onLogActivity={handleLogActivity}
            showForm={showActivityForm}
            setShowForm={setShowActivityForm}
            activityType={activityType}
            setActivityType={setActivityType}
            activityOutcome={activityOutcome}
            setActivityOutcome={setActivityOutcome}
            activityContent={activityContent}
            setActivityContent={setActivityContent}
            activityFollowUp={activityFollowUp}
            setActivityFollowUp={setActivityFollowUp}
          />
        </div>
      </div>
    </div>
  );
}
