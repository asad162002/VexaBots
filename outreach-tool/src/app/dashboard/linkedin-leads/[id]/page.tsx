'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Mail, ExternalLink, User, Building2, Calendar, CheckCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface LinkedInLead {
  id: string;
  place_id: string | null;
  lead_name: string | null;
  title: string | null;
  email: string | null;
  email_status: string | null;
  linkedin_url: string | null;
  source: string | null;
  notes: string | null;
  assigned_to: string | null;
  assigned_at: string | null;
  assigned_by: string | null;
  created_at: string;
  updated_at: string;
}

export default function LinkedInLeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const unwrappedParams = React.use(params);
  const leadId = unwrappedParams.id;
  const { user } = useAuth();

  const [lead, setLead] = useState<LinkedInLead | null>(null);
  const [profiles, setProfiles] = useState<{id: string; full_name: string | null; email: string | null}[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assignedTo, setAssignedTo] = useState('');
  const [activities, setActivities] = useState<any[]>([]);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [activityType, setActivityType] = useState('call');
  const [activityContent, setActivityContent] = useState('');
  const [activityOutcome, setActivityOutcome] = useState('');
  const [activityFollowUp, setActivityFollowUp] = useState('');

  useEffect(() => {
    fetchLead();
    fetchProfiles();
  }, [leadId]);

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .order('full_name');
    if (error) {
      console.error('Error fetching profiles:', error);
    } else {
      setProfiles(data ?? []);
    }
  };

  const fetchLead = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('linkedin_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (error) {
      console.error('Error fetching lead:', error);
    } else if (data) {
      setLead(data as LinkedInLead);
      setAssignedTo(data.assigned_to || '');
      fetchActivities();
    }
    setLoading(false);
  };

  const fetchActivities = useCallback(async () => {
    const { data, error: activitiesError } = await supabase
      .from('lead_activities')
      .select('*')
      .eq('lead_id', leadId)
      .eq('lead_table', 'linkedin_leads')
      .order('created_at', { ascending: false });

    if (activitiesError) {
      console.error('Error fetching activities:', activitiesError);
    } else {
      setActivities(data ?? []);
    }
  }, [leadId]);

  const handleLogActivity = async () => {
    if (!user || !activityContent.trim()) return;

    const { error: insertError } = await supabase.from('lead_activities').insert({
      lead_id: leadId,
      lead_table: 'linkedin_leads',
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
  };

  const saveAssignment = async () => {
    if (!lead) return;
    setSaving(true);

    // Save assignment if changed
    if (assignedTo !== (lead.assigned_to || '')) {
      const previousAssignee = lead.assigned_to;
      await supabase.from('linkedin_leads')
        .update({
          assigned_to: assignedTo || null,
          assigned_at: assignedTo ? new Date().toISOString() : null,
        } as any)
        .eq('id', lead.id);

      // Log to assignment_history when assignment changes
      if (assignedTo !== previousAssignee) {
        await supabase.from('assignment_history').insert({
          lead_id: lead.id,
          lead_table: 'linkedin_leads',
          assigned_to: assignedTo || null,
          assigned_by: user?.id || null,
          assigned_at: new Date().toISOString(),
          previous_assignee: previousAssignee,
          notes: lead.notes || null,
        });
      }

      setLead({ ...lead, assigned_to: assignedTo || null, assigned_at: assignedTo ? new Date().toISOString() : null });
    }
    setSaving(false);
  };

  const handleEmailClick = (email: string) => {
    window.location.href = `mailto:${email}`;
  };

  const handleLinkedInClick = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-400">Loading lead...</div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 mb-4">Lead not found</div>
        <button
          onClick={() => router.push('/dashboard/linkedin-leads')}
          className="text-blue-400 hover:text-blue-300"
        >
          Return to LinkedIn Leads
        </button>
      </div>
    );
  }

  const emailVerified = lead.email_status === 'verified';

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push('/dashboard/linkedin-leads')}
          className="p-2 text-gray-400 hover:text-white hover:bg-[#27272a] rounded-lg transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-2xl font-bold text-white">Lead Details</h1>
      </div>

      <div className="lg:grid lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Info */}
          <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center">
                  <User className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">{lead.lead_name || 'Untitled Contact'}</h2>
                  {lead.title && (
                    <p className="text-gray-400 mt-1">{lead.title}</p>
                  )}
                </div>
              </div>

              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                lead.source === 'apollo_enrichment'
                  ? 'bg-purple-500/20 text-purple-300'
                  : 'bg-blue-500/20 text-blue-300'
              }`}>
                {lead.source?.replace('_', ' ') || 'Unknown'}
              </span>
            </div>

            {/* Contact Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              {lead.email && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                    Email Address
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 flex-1">
                      <Mail className="w-4 h-4 text-gray-500" />
                      <span className="text-white">{lead.email}</span>
                      {lead.email_status === 'verified' && (
                        <CheckCircleIcon />
                      )}
                    </div>
                    <button
                      onClick={() => handleEmailClick(lead.email!)}
                      className="p-1 text-gray-400 hover:text-white hover:bg-[#27272a] rounded transition"
                      title="Send email"
                    >
                      <Mail className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {lead.linkedin_url && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                    LinkedIn Profile
                  </label>
                  <button
                    onClick={() => handleLinkedInClick(lead.linkedin_url!)}
                    className="flex items-center gap-2 text-blue-400 hover:text-blue-300"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {lead.linkedin_url}
                  </button>
                </div>
              )}

              {lead.place_id && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                    Place ID
                  </label>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-300 font-mono text-sm">{lead.place_id}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                  Source
                </label>
                <span className="text-white">{lead.source?.replace('_', ' ') || 'Unknown'}</span>
              </div>
              {profiles.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                    Assign To
                  </label>
                  <select
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  >
                    <option value="">Unassigned</option>
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.full_name || profile.email || 'Unnamed'}
                      </option>
                    ))}
                  </select>
                  {assignedTo !== (lead.assigned_to || '') && (
                    <button
                      onClick={saveAssignment}
                      disabled={saving}
                      className="mt-2 w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium rounded-lg text-sm transition disabled:cursor-not-allowed"
                    >
                      {saving ? 'Saving...' : 'Save Assignment'}
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="mt-6 pt-4 border-t border-[#27272a]">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  Added: {new Date(lead.created_at).toLocaleString()}
                </span>
                {lead.updated_at !== lead.created_at && (
                  <>
                    <span className="text-gray-600">·</span>
                    <span>
                      Updated: {new Date(lead.updated_at).toLocaleString()}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Activity Log */}
          <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Activity Log</h2>
              <button
                onClick={() => setShowActivityForm(!showActivityForm)}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium"
              >
                {showActivityForm ? 'Cancel' : '+ Log Activity'}
              </button>
            </div>

            {showActivityForm && (
              <div className="mb-4 p-4 bg-[#27272a]/30 border border-[#3f3f46] rounded-lg">
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
                      Type
                    </label>
                    <select
                      id="activity-type"
                      value={activityType}
                      onChange={(e) => setActivityType(e.target.value)}
                      className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="call">Call</option>
                      <option value="text">Text</option>
                      <option value="email">Email</option>
                      <option value="meeting">Meeting</option>
                      <option value="note">Note</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
                      Outcome
                    </label>
                    <input
                      id="activity-outcome"
                      type="text"
                      value={activityOutcome}
                      onChange={(e) => setActivityOutcome(e.target.value)}
                      placeholder="e.g. Interested, No answer"
                      className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
                    Details
                  </label>
                  <textarea
                    id="activity-content"
                    value={activityContent}
                    onChange={(e) => setActivityContent(e.target.value)}
                    placeholder="What happened in this interaction..."
                    rows={3}
                    className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
                    Next Follow-up
                  </label>
                  <input
                    id="activity-follow-up"
                    type="date"
                    value={activityFollowUp}
                    onChange={(e) => setActivityFollowUp(e.target.value)}
                    className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleLogActivity}
                    disabled={!activityContent.trim()}
                    className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-green-800 text-white font-semibold rounded-lg text-sm transition disabled:cursor-not-allowed"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setShowActivityForm(false)}
                    className="px-4 py-2 bg-[#27272a] hover:bg-[#3f3f46] text-gray-300 font-medium rounded-lg text-sm transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {activities.length === 0 ? (
              <p className="text-sm text-gray-500">No activities logged yet.</p>
            ) : (
              <div className="space-y-4">
                {activities.map((activity) => {
                  const profile = profiles.find(p => p.id === activity.profile_id);
                  return (
                    <div key={activity.id} className="border-b border-[#27272a] last:border-0 pb-3 last:pb-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                              activity.activity_type === 'call' ? 'bg-gray-500/20 text-gray-300' :
                              activity.activity_type === 'text' ? 'bg-blue-500/20 text-blue-400' :
                              activity.activity_type === 'email' ? 'bg-purple-500/20 text-purple-400' :
                              activity.activity_type === 'meeting' ? 'bg-green-500/20 text-green-400' :
                              'bg-gray-500/20 text-gray-300'
                            }`}>
                              {activity.activity_type.charAt(0).toUpperCase() + activity.activity_type.slice(1)}
                            </span>
                            {activity.outcome && (
                              <span className="text-xs text-gray-400">
                                {activity.outcome}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-300 break-words">{activity.content}</p>
                          {activity.next_follow_up_at && (
                            <p className="text-xs text-blue-400 mt-1">
                              Next follow-up: {new Date(activity.next_follow_up_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <div className="text-right text-xs text-gray-500 shrink-0">
                          <p>{profile?.full_name || profile?.email || 'Unknown'}</p>
                          {new Date(activity.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckCircleIcon() {
  return (
    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}