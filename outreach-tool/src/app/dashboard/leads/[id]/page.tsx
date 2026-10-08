'use client';

import { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase';
import { STATUS_LABELS, STATUS_COLORS, type Lead, type LeadStatus, type Profile } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

const STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'interested', label: 'Interested' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'send_info', label: 'Send Info' },
  { value: 'meeting_booked', label: 'Meeting Booked' },
  { value: 'dead', label: 'Dead' },
];

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const [status, setStatus] = useState<LeadStatus>('new');
  const [notes, setNotes] = useState('');
  const [nextFollowUp, setNextFollowUp] = useState('');
  const [assignedTo, setAssignedTo] = useState<string>('');

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
    setNotes(data.notes ?? '');
    setNextFollowUp(data.next_follow_up_at ? new Date(data.next_follow_up_at).toISOString().split('T')[0] : '');
    setAssignedTo(data.assigned_to ?? '');
    setLoading(false);
  };

  const handleSave = async () => {
    if (!lead) return;

    setSaving(true);
    setError('');

    const updates: Record<string, unknown> = {
      status,
      notes: notes.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (!lead.owner_id && user) {
      updates.owner_id = user.id;
    }

    if (nextFollowUp) {
      updates.next_follow_up_at = new Date(nextFollowUp).toISOString();
    } else {
      updates.next_follow_up_at = null;
    }

    if (status !== 'new') {
      updates.last_contacted_at = new Date().toISOString();
    }

    if (assignedTo) {
      updates.assigned_to = assignedTo;
      // Only set assigned_at if this is a new assignment (wasn't assigned before)
      if (!lead.assigned_to) {
        updates.assigned_at = new Date().toISOString();
      }
    } else {
      updates.assigned_to = null;
      updates.assigned_at = null;
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
        <div className="text-gray-400 text-sm">Loading lead...</div>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-12 text-center bg-[#0f0f0f]">
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

  const handleCall = (phone: string | null) => {
    if (phone) {
      window.location.href = `tel:${phone}`;
    }
  };

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
        {/* Main info */}
        <div className="lg:col-span-2 space-y-5">
          {/* Header card */}
          <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-white">
                  {lead.title || 'Untitled Business'}
                </h1>
                {lead.owner_name && (
                  <p className="text-gray-400 mt-1 text-sm">
                    Contact: <span className="font-medium text-gray-200">{lead.owner_name}</span>
                    {lead.owner_role && ` — ${lead.owner_role}`}
                  </p>
                )}
              </div>
              <div className="shrink-0">
                <span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold ${STATUS_COLORS[lead.status]} border ${STATUS_COLORS[lead.status].replace('text-', 'border-').replace('-400', '-500').replace('-500', '-400')}`}>
                  {STATUS_LABELS[lead.status]}
                </span>
              </div>
              {lead.assigned_to && (
                <div className="shrink-0">
                  <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/30">
                    Assigned
                  </span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3 mt-6">
              {lead.phone && (
                <button
                  onClick={() => handleCall(lead.phone)}
                  className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-500 active:bg-green-700 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Call Now
                </button>
              )}
              {lead.website && (
                <a
                  href={lead.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Visit Website
                </a>
              )}
            </div>
          </div>

          {/* Quick info */}
          <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-5">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Quick Info</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
              <p className="text-xs text-gray-500 mb-1">ICP Score</p>
              <p className="text-xl font-bold text-white">
                {lead.icp_score !== null ? lead.icp_score : '-'}
              </p>
            </div>
            {lead.phone && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Phone</p>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(lead.phone!)}
                  className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 font-medium"
                  title="Click to copy phone number"
                >
                  {lead.phone}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
              <div>
                <p className="text-xs text-gray-500 mb-1">Source</p>
                <p className="text-sm font-medium text-gray-200 capitalize">
                  {lead.source.replace('_', ' ')}
                </p>
              </div>
              {lead.city && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">City</p>
                  <p className="text-sm font-medium text-gray-200">{lead.city}</p>
                </div>
              )}
              {lead.country_code && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Country</p>
                  <p className="text-sm font-medium text-gray-200">{lead.country_code}</p>
                </div>
              )}
              {lead.postal_code && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Postal Code</p>
                  <p className="text-sm font-medium text-gray-200">{lead.postal_code}</p>
                </div>
              )}
              {lead.company_size_estimate && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Size</p>
                  <p className="text-sm font-medium text-gray-200 capitalize">{lead.company_size_estimate}</p>
                </div>
              )}
              {lead.ad_running && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Running Ads</p>
                  <p className="text-sm font-medium text-green-400">Yes</p>
                </div>
              )}
              {lead.total_score && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Rating</p>
                  <p className="text-sm font-medium text-gray-200">{lead.total_score}</p>
                </div>
              )}
              {lead.reviews_count && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Reviews</p>
                  <p className="text-sm font-medium text-gray-200">{lead.reviews_count}</p>
                </div>
              )}
              {lead.place_id && (
                <div className="sm:col-span-2">
                  <p className="text-xs text-gray-500 mb-1">Google Maps</p>
                  <a
                    href={`https://www.google.com/maps/place/?q=place_id:${lead.place_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 text-sm break-all flex items-center gap-1"
                  >
                    {lead.url || `https://www.google.com/maps/place/?q=place_id:${lead.place_id}`}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Address */}
          {lead.address && (
            <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-5">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Address</h2>
              <p className="text-sm text-gray-200 break-all">{lead.address}</p>
            </div>
          )}

          {/* Opening Hours */}
          {lead.opening_hours && (
            <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-5">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Opening Hours</h2>
              <p className="text-sm text-gray-300 whitespace-pre-line">{lead.opening_hours}</p>
            </div>
          )}

          {/* Competitors */}
          {lead.source_details && (
            (() => {
              const details = typeof lead.source_details === 'string' ? JSON.parse(lead.source_details) : lead.source_details;
              const competitors = details?.competitors;
              if (competitors && Array.isArray(competitors) && competitors.length > 0) {
                return (
                  <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-5">
                    <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Competitors</h2>
                    <div className="space-y-2">
                      {competitors.map((c: Record<string, unknown>, idx: number) => (
                        <div key={idx} className="flex items-center justify-between">
                          <span className="text-sm text-gray-200">
                            {(c.name as string) ?? 'Unknown'}
                          </span>
                          {c.reviews != null && (
                            <span className="text-xs text-gray-500">
                              {String(c.reviews)} reviews{c.rating != null && c.reviews != null && ` | ${String(c.rating)}★`}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }
              return null;
            })()
          )}

          {/* Owner info */}
          {lead.owner_name && (
            <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-5">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Owner / Contact</h2>
              <div className="space-y-3">
                {lead.owner_name && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Name</p>
                    <p className="text-gray-200 font-medium">{lead.owner_name}</p>
                  </div>
                )}
                {lead.owner_role && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Role</p>
                    <p className="text-gray-300">{lead.owner_role}</p>
                  </div>
                )}
                {lead.owner_linkedin_url && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">LinkedIn</p>
                    <a
                      href={lead.owner_linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 text-sm break-all"
                    >
                      {lead.owner_linkedin_url}
                    </a>
                  </div>
                )}
                {lead.owner_snippet && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Notes</p>
                    <p className="text-gray-400 text-sm">{lead.owner_snippet}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Ad signals */}
          {(lead.running_google_ads || lead.running_fb_ads || lead.apollo_description) && (
            <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-5">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Ad & Enrichment Data</h2>
              <div className="space-y-3">
                {lead.running_google_ads && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-semibold">Google Ads</span>
                    <span className="text-sm text-gray-400">Running ads</span>
                  </div>
                )}
                {lead.running_fb_ads && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-semibold">Facebook Ads</span>
                    <span className="text-sm text-gray-400">Running ads</span>
                  </div>
                )}
                {lead.apollo_description && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Apollo Description</p>
                    <p className="text-sm text-gray-300">{lead.apollo_description}</p>
                  </div>
                )}
                {lead.apollo_revenue && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Estimated Revenue</p>
                    <p className="text-sm text-gray-300">{lead.apollo_revenue}</p>
                  </div>
                )}
                {lead.apollo_employees && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Employees</p>
                    <p className="text-sm text-gray-300">{lead.apollo_employees}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Update panel */}
        <div className="lg:col-span-1">
          <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-5 sticky top-6">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Update</h2>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as LeadStatus)}
                className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-[#1a1a1a]">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {profiles.length > 0 && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                  Assign To
                </label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                >
                  <option value="" className="bg-[#1a1a1a]">Unassigned</option>
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id} className="bg-[#1a1a1a]">
                      {profile.full_name || profile.email || 'Unnamed'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                Notes (short)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Quick note about this contact..."
                rows={3}
                className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition"
              />
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                Next Follow-up
              </label>
              <input
                type="date"
                value={nextFollowUp}
                onChange={(e) => setNextFollowUp(e.target.value)}
                className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:bg-blue-800 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>

            <div className="mt-3 text-xs text-gray-500 text-center space-y-1">
              {lead.last_contacted_at && (
                <p>Last contacted: {new Date(lead.last_contacted_at).toLocaleString()}</p>
              )}
              {lead.next_follow_up_at && (
                <p className="text-blue-400 font-medium">
                  Follow-up due: {new Date(lead.next_follow_up_at).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
