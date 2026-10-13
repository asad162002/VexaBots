'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { type Profile, type LeadStatus } from '@/lib/types';
import Spinner from '@/components/ui/spinner';
import { useAuth } from '@/lib/auth-context';
import { Shield, TrendingUp, BarChart3, Clock } from 'lucide-react';

interface LeadWithDetails {
  id: string;
  title: string;
  company: string | null;
  status: LeadStatus;
  source: string | null;
  category_name: string | null;
  assigned_to: string | null;
  assigned_at: string | null;
  assigned_by: string | null;
  updated_at: string | null;
}

interface ActivityEntry {
  id: string;
  action: string;
  description: string;
  timestamp: string;
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [memberStats, setMemberStats] = useState<MemberStats[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<StatusDistribution[]>([]);
  const [sourceDistribution, setSourceDistribution] = useState<SourceDistribution[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const [leadsReceivedLog, setLeadsReceivedLog] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<string>('all');

  useEffect(() => {
    fetchAnalytics();
  }, [dateFilter]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      // Check if user is admin
      const { data: currentProfile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user?.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error checking admin status:', profileError);
      }
      const userIsAdmin = currentProfile?.role === 'admin';
      setIsAdmin(userIsAdmin);

      // Fetch all profiles (admins see all, members only need their own data)
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*');
      if (profilesError) throw profilesError;

      // Fetch leads - admins get all, members get only their assigned leads
      let leadsQuery = supabase
        .from('leads')
        .select('id, title, company, status, source, category_name, assigned_at, assigned_by, updated_at');

      // Non-admins only see their own leads
      if (!userIsAdmin && user?.id) {
        leadsQuery = leadsQuery.eq('assigned_to', user.id);
      }

      // Apply date filter based on assigned_at
      const now = new Date();
      let pastDate: Date | null = null;
      if (dateFilter === '24h') {
        pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      } else if (dateFilter === '7d') {
        pastDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (dateFilter === '30d') {
        pastDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      if (pastDate) {
        leadsQuery = leadsQuery.gte('assigned_at', pastDate.toISOString());
      }

      const { data: leads, error: leadsError } = await leadsQuery;
      if (leadsError) throw leadsError;

      // Fetch activity log from assignment_history
      const { data: activityData, error: activityError } = await supabase
        .from('assignment_history')
        .select('lead_id, assigned_to, assigned_by, assigned_at, previous_assignee, notes')
        .order('assigned_at', { ascending: false })
        .limit(20);

      if (activityError) {
        console.error('Error fetching activity:', activityError.message);
      }

      // Build activity entries for members: only show what happened to them
      const profileMap: Record<string, Profile> = {};
      (profiles || []).forEach((p) => { profileMap[p.id] = p; });

      // Personal activity log for members (leads assigned to them)
      const myActivity: ActivityEntry[] = [];
      const myReceived: ActivityEntry[] = [];
      if (activityData && user?.id) {
        activityData.forEach(entry => {
          // What admin did - assignments made by admins to me
          if (entry.assigned_to === user.id && entry.assigned_by && entry.assigned_by !== user.id) {
            const adminName = profileMap[entry.assigned_by]?.email || 'Admin';
            myReceived.push({
              id: entry.lead_id + '_received_' + entry.assigned_at,
              action: 'assigned',
              description: `${adminName} assigned you a lead: ${entry.notes || 'New lead assigned'}`,
              timestamp: entry.assigned_at
            });
          }
          // What I did (if any action attributed to my user)
          if (entry.assigned_by === user.id) {
            const assigneeName = profileMap[entry.assigned_to]?.email || 'Unknown';
            myActivity.push({
              id: entry.lead_id + '_assigned_' + entry.assigned_at,
              action: 'assigned',
              description: `Assigned lead to ${assigneeName}`,
              timestamp: entry.assigned_at
            });
          }
        });
      }

      // For admins: show team activity
      const adminActivity: ActivityEntry[] = [];
      if (userIsAdmin && activityData) {
        activityData.forEach(entry => {
          if (entry.assigned_by && entry.assigned_by !== entry.assigned_to) {
            const assignerName = profileMap[entry.assigned_by]?.email || 'Someone';
            const assigneeName = profileMap[entry.assigned_to]?.email || 'Unknown';
            adminActivity.push({
              id: entry.lead_id + '_team_' + entry.assigned_at,
              action: 'assigned',
              description: `${assignerName} assigned a lead to ${assigneeName}`,
              timestamp: entry.assigned_at
            });
          }
        });
      }

      setActivityLog(userIsAdmin ? adminActivity : myActivity);
      setLeadsReceivedLog(myReceived);

      if (userIsAdmin) {
        // Admin analytics - same as before
        const memberMap: Record<string, MemberStats> = {};
        type StatusKey = 'new' | 'contacted' | 'interested' | 'not_interested' | 'send_info' | 'meeting_booked' | 'dead';
        const EMPTY_STATUS: Record<StatusKey, number> = {
          new: 0, contacted: 0, interested: 0, not_interested: 0,
          send_info: 0, meeting_booked: 0, dead: 0
        };

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

        (leads || []).forEach((lead) => {
          if (lead.assigned_to && memberMap[lead.assigned_to]) {
            memberMap[lead.assigned_to].leads_assigned += 1;
            memberMap[lead.assigned_to].total_leads += 1;
            const statusKey = lead.status as StatusKey;
            memberMap[lead.assigned_to].leads_by_status[statusKey] =
              (memberMap[lead.assigned_to].leads_by_status[statusKey] || 0) + 1;
          }
        });

        const memberArray = Object.values(memberMap).sort((a, b) => {
          return b.leads_assigned - a.leads_assigned;
        });
        setMemberStats(memberArray);

        // Status distribution across all leads (admin view)
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

        // Source distribution (admin view)
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
      } else {
        // Member analytics - only their own data
        setMemberStats([]);
        setStatusDistribution([]);
        setSourceDistribution([]);
      }

    } catch (err: any) {
      console.error('Error fetching analytics:', err);
      setError('Failed to load analytics data.');
    } finally {
      setLoading(false);
    }
  };

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
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isAdmin ? 'Team performance and lead distribution overview' : 'Your personal lead performance'}
          </p>
        </div>
        {!isAdmin && (
          <span className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-1.5">
            Member View
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="px-3 py-1.5 bg-[#27272a] border border-[#3f3f46] rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Time</option>
          <option value="30d">Last 30 Days</option>
          <option value="7d">Last 7 Days</option>
          <option value="24h">Last 24 Hours</option>
        </select>
      </div>

      {/* Admin Team Performance Cards */}
      {isAdmin && memberStats.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-gray-400" />
            Team Performance
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {memberStats.map((member) => {
              const hasLeads = member.leads_assigned > 0;
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
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          member.role === 'admin'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                        }`}>
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

                  {hasLeads && Object.values(member.leads_by_status).some(v => v > 0) && (
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
      )}

      {/* Member Personal Stats */}
      {!isAdmin && (
        <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-gray-400" />
            My Performance
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Your lead assignment statistics and performance overview.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#27272a] rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-white">{memberStats.reduce((sum, m) => sum + m.leads_assigned, 0)}</p>
              <p className="text-xs text-gray-500 mt-1">Total Leads Assigned</p>
            </div>
            <div className="bg-[#27272a] rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-green-400">
                {memberStats.length > 0 
                  ? Math.round(((memberStats[0]?.leads_by_status?.meeting_booked ?? 0) + 
                               (memberStats[0]?.leads_by_status?.interested ?? 0) + 
                               (memberStats[0]?.leads_by_status?.send_info ?? 0)) / 
                              Math.max(1, memberStats[0]?.leads_assigned ?? 0) * 100)
                  : 0}%
              </p>
              <p className="text-xs text-gray-500 mt-1">Conversion Rate</p>
            </div>
            <div className="bg-[#27272a] rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-purple-400">{leadsReceivedLog.length}</p>
              <p className="text-xs text-gray-500 mt-1">Recently Received</p>
            </div>
          </div>
        </div>
      )}

      {/* Admin Status Distribution */}
      {isAdmin && statusDistribution.length > 0 && (
        <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-5">
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
      )}

      {/* Admin Source Distribution */}
      {isAdmin && sourceDistribution.length > 0 && (
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
      )}

      {/* Activity Log - for both admin and member */}
      <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-400" />
          {isAdmin ? 'Team Activity Log' : 'Recent Activity'}
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          {isAdmin 
            ? 'Recent lead assignments across your team.'
            : 'Recent leads assigned to you by admins and your activity.'}
        </p>

        {activityLog.length === 0 && leadsReceivedLog.length === 0 ? (
          <p className="text-xs text-gray-500 py-4 text-center">
            No recent activity.
          </p>
        ) : (
          <div className="space-y-2">
            {/* Show leads received by member */}
            {!isAdmin && leadsReceivedLog.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 p-3 bg-[#27272a] rounded-lg">
                <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-white">{entry.description}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(entry.timestamp).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            ))}
            {/* Show team activity for admins OR personal activity for members */}
            {activityLog.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 p-3 bg-[#27272a] rounded-lg">
                <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-white">{entry.description}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(entry.timestamp).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
