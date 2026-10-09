'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { type Profile, type LeadStatus } from '@/lib/types';
import Spinner from '@/components/ui/spinner';
import { useAuth } from '@/lib/auth-context';

interface MemberStats {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  leads_assigned: number;
  leads_by_status: Record<LeadStatus, number>;
  total_leads: number;
}

interface StatusDistribution {
  status: LeadStatus;
  count: number;
  percentage: number;
}

interface SourceDistribution {
  source: string;
  count: number;
  percentage: number;
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [memberStats, setMemberStats] = useState<MemberStats[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<StatusDistribution[]>([]);
  const [sourceDistribution, setSourceDistribution] = useState<SourceDistribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      // Check if user is admin first
      const { data: currentProfile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user?.id)
        .single();

      if (profileError) {
        console.error('Error checking admin status:', profileError);
      } else {
        setIsAdmin(currentProfile?.role === 'admin');
      }

      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*');

      if (profilesError) throw profilesError;

      // Fetch all leads with assignment data
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('assigned_to, assigned_by, status, source, category_name');

      if (leadsError) throw leadsError;

      // Build member stats
      const profileMap: Record<string, Profile> = {};
      (profiles || []).forEach((p) => { profileMap[p.id] = p; });

      const memberMap: Record<string, MemberStats> = {};

      type StatusKey = 'new' | 'contacted' | 'interested' | 'not_interested' | 'send_info' | 'meeting_booked' | 'dead';
      const EMPTY_STATUS: Record<StatusKey, number> = {
        new: 0, contacted: 0, interested: 0, not_interested: 0,
        send_info: 0, meeting_booked: 0, dead: 0
      };

      // Initialize all profiles
      (profiles || []).forEach((profile) => {
        memberMap[profile.id] = {
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
          role: profile.role,
          leads_assigned: 0,
          leads_by_status: { ...EMPTY_STATUS },
          total_leads: 0
        };
      });

      // Count leads per assignee
      (leads || []).forEach((lead) => {
        if (lead.assigned_to && memberMap[lead.assigned_to]) {
          memberMap[lead.assigned_to].leads_assigned += 1;
          memberMap[lead.assigned_to].total_leads += 1;
          const statusKey = lead.status as StatusKey;
          memberMap[lead.assigned_to].leads_by_status[statusKey] = 
            (memberMap[lead.assigned_to].leads_by_status[statusKey] || 0) + 1;
        }
      });

      // Also include admins who assigned leads
      const assignerIds = new Set<string>();
      (leads || []).forEach((lead) => {
        if (lead.assigned_by && !assignerIds.has(lead.assigned_by)) {
          assignerIds.add(lead.assigned_by);
        }
      });

      assignerIds.forEach((assignerId) => {
        if (!memberMap[assignerId]) {
          memberMap[assignerId] = {
            id: assignerId,
            full_name: null,
            email: null,
            role: null,
            leads_assigned: 0,
            leads_by_status: { ...EMPTY_STATUS },
            total_leads: 0
          };
        }
      });

      // Also compute assigner stats
      const assignerLeadCounts: Record<string, number> = {};
      (leads || []).forEach((lead) => {
        if (lead.assigned_by) {
          assignerLeadCounts[lead.assigned_by] = 
            (assignerLeadCounts[lead.assigned_by] || 0) + 1;
        }
      });

      // Convert to sorted array (most leads assigned first)
      const memberArray = Object.values(memberMap).sort((a, b) => {
        return b.leads_assigned - a.leads_assigned;
      });

      setMemberStats(memberArray);

      // Status distribution
      const statusCounts: Record<LeadStatus, number> = {
        new: 0, contacted: 0, interested: 0, not_interested: 0,
        send_info: 0, meeting_booked: 0, dead: 0
      };
      (leads || []).forEach((lead) => {
        const s = lead.status as LeadStatus;
        statusCounts[s] = (statusCounts[s] || 0) + 1;
      });

      const totalLeads = leads?.length || 1;
      const statusDist = Object.entries(statusCounts).map(([status, count]) => ({
        status: status as LeadStatus,
        count,
        percentage: totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0
      })).filter(s => s.count > 0);

      setStatusDistribution(statusDist);

      // Source distribution
      const sourceCounts: Record<string, number> = {};
      (leads || []).forEach((lead) => {
        const src = lead.source || 'unknown';
        sourceCounts[src] = (sourceCounts[src] || 0) + 1;
      });

      const sourceDist = Object.entries(sourceCounts)
        .map(([source, count]) => ({
          source,
          count,
          percentage: totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0
        }))
        .sort((a, b) => b.count - a.count);

      setSourceDistribution(sourceDist);

    } catch (err: any) {
      console.error('Error fetching analytics:', err);
      setError('Failed to load analytics data.');
    } finally {
      setLoading(false);
    }
  };

  const STATUS_LABELS_DISPLAY: Record<LeadStatus, string> = {
    new: 'New',
    contacted: 'Contacted',
    interested: 'Interested',
    not_interested: 'Not Interested',
    send_info: 'Send Info',
    meeting_booked: 'Meeting Booked',
    dead: 'Dead',
  };

  const STATUS_COLORS: Record<LeadStatus, string> = {
    new: 'bg-gray-400',
    contacted: 'bg-blue-400',
    interested: 'bg-green-400',
    not_interested: 'bg-red-400',
    send_info: 'bg-yellow-400',
    meeting_booked: 'bg-purple-400',
    dead: 'bg-gray-600',
  };

  const SOURCE_LABELS: Record<string, string> = {
    google_maps: 'Google Maps',
    manual: 'Manual',
    csv_import: 'CSV Import',
    apify_n8n: 'Apify/n8n',
    linkedin: 'LinkedIn',
    other: 'Other',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex items-center gap-3 text-gray-500">
          <Spinner size="md" />
          <span>Loading analytics...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Team performance and lead distribution overview
          </p>
        </div>
        {!isAdmin && (
          <span className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-1.5">
            Admin only
          </span>
        )}
      </div>

      {/* Team Performance Cards */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Team Performance</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {memberStats.map((member) => {
            const hasLeads = member.leads_assigned > 0;
            const avgPerStatus = hasLeads
              ? Object.values(member.leads_by_status).filter(v => v > 0).length
              : 0;
            const conversionRate = hasLeads
              ? Math.round(
                  ((member.leads_by_status.meeting_booked +
                    member.leads_by_status.interested +
                    member.leads_by_status.send_info) /
                    member.leads_assigned) *
                    100
                )
              : 0;

            return (
              <div
                key={member.id}
                className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-4"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-300 flex-shrink-0">
                    {member.full_name
                      ? member.full_name.charAt(0).toUpperCase()
                      : (member.email?.charAt(0).toUpperCase() ?? '?')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {member.full_name || member.email || 'Unknown'}
                    </p>
                    {member.role && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          member.role === 'admin'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                        }`}
                      >
                        {member.role}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-center mb-3">
                  <div>
                    <p className="text-2xl font-bold text-white">{member.leads_assigned}</p>
                    <p className="text-xs text-gray-500">Assigned Leads</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-400">{conversionRate}%</p>
                    <p className="text-xs text-gray-500">Est. Conversion</p>
                  </div>
                </div>

                {hasLeads && avgPerStatus > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(member.leads_by_status).map(([status, count]) => {
                      if (count === 0) return null;
                      const s = status as LeadStatus;
                      return (
                        <div
                          key={status}
                          className="flex items-center gap-1 text-xs"
                          title={`${STATUS_LABELS_DISPLAY[s]}: ${count}`}
                        >
                          <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[s]}`} />
                          <span className="text-gray-400">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Status Distribution */}
      <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-5 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Lead Status Distribution</h2>
        <div className="space-y-3">
          {statusDistribution.map((item) => (
            <div key={item.status}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-300">{STATUS_LABELS_DISPLAY[item.status]}</span>
                <span className="text-sm text-gray-400">{item.count} ({item.percentage}%)</span>
              </div>
              <div className="w-full bg-[#27272a] rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${STATUS_COLORS[item.status]}`}
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Source Distribution */}
      <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4">Lead Source Distribution</h2>
        <div className="space-y-3">
          {sourceDistribution.map((item) => (
            <div key={item.source}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-300">
                  {SOURCE_LABELS[item.source] || item.source.replace('_', ' ')}
                </span>
                <span className="text-sm text-gray-400">{item.count} ({item.percentage}%)</span>
              </div>
              <div className="w-full bg-[#27272a] rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-blue-500"
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
