'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import Spinner from '@/components/ui/spinner';
import AnalyticsHeader from '@/components/dashboard/AnalyticsHeader';
import TeamPerformanceCard from '@/components/dashboard/TeamPerformanceCard';
import TeamConversionFunnel from '@/components/dashboard/TeamConversionFunnel';
import MemberFunnel from '@/components/dashboard/MemberFunnel';
import ActivityLogList from '@/components/dashboard/ActivityLogList';
import {
  type MemberStats, type ConversionFunnel, type StatusDistribution,
  type SourceDistribution, type LeadWithDetails, type ActivityEntry,
  computeFunnel, EMPTY_STATUS,
} from '@/components/dashboard/analytics-types';
import { BarChart3 } from 'lucide-react';

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [memberStats, setMemberStats] = useState<MemberStats[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<StatusDistribution[]>([]);
  const [sourceDistribution, setSourceDistribution] = useState<SourceDistribution[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const [leadsReceivedLog, setLeadsReceivedLog] = useState<ActivityEntry[]>([]);
  const [personalFunnel, setPersonalFunnel] = useState<ConversionFunnel | null>(null);
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

      // Fetch profiles and leads
      const { data: profiles, error: profilesError } = await supabase.from('profiles').select('*');
      if (profilesError) throw profilesError;

      let leadsQuery = supabase
        .from('leads')
        .select('id, title, status, source, category_name, assigned_to, assigned_at, assigned_by, updated_at');

      if (!userIsAdmin && user?.id) {
        leadsQuery = leadsQuery.eq('assigned_to', user.id);
      }

      // Apply date filter
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

      // Fetch activity log
      const { data: activityData, error: activityError } = await supabase
        .from('assignment_history')
        .select('lead_id, assigned_to, assigned_by, assigned_at, previous_assignee, notes')
        .order('assigned_at', { ascending: false })
        .limit(20);

      if (activityError) {
        console.error('Error fetching activity:', activityError.message);
      }

      // Process activity entries
      const profileMap: Record<string, any> = {};
      (profiles || []).forEach((p) => { profileMap[p.id] = p; });

      const myActivity: ActivityEntry[] = [];
      const myReceived: ActivityEntry[] = [];
      if (activityData && user?.id) {
        activityData.forEach(entry => {
          if (entry.assigned_to === user.id && entry.assigned_by && entry.assigned_by !== user.id) {
            const adminName = profileMap[entry.assigned_by]?.email || 'Admin';
            myReceived.push({
              id: entry.lead_id + '_received_' + entry.assigned_at,
              action: 'assigned',
              description: `${adminName} assigned you a lead: ${entry.notes || 'New lead assigned'}`,
              timestamp: entry.assigned_at,
            });
          }
          if (entry.assigned_by === user.id) {
            const assigneeName = profileMap[entry.assigned_to]?.email || 'Unknown';
            myActivity.push({
              id: entry.lead_id + '_assigned_' + entry.assigned_at,
              action: 'assigned',
              description: `Assigned lead to ${assigneeName}`,
              timestamp: entry.assigned_at,
            });
          }
        });
      }

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
              timestamp: entry.assigned_at,
            });
          }
        });
      }

      setActivityLog(userIsAdmin ? adminActivity : myActivity);
      setLeadsReceivedLog(myReceived);

      // Compute status counts
      const statusCounts: Record<string, number> = {
        new: 0, contacted: 0, interested: 0, not_interested: 0,
        send_info: 0, meeting_booked: 0, dead: 0
      };
      (leads || []).forEach((lead) => {
        const s = lead.status;
        statusCounts[s] = (statusCounts[s] || 0) + 1;
      });

      if (userIsAdmin) {
        // Build member stats
        const memberMap: Record<string, MemberStats> = {};
        (profiles || []).forEach((profile) => {
          memberMap[profile.id] = {
            id: profile.id,
            full_name: profile.full_name,
            email: profile.email,
            role: profile.role,
            leads_assigned: 0,
            leads_by_status: { ...EMPTY_STATUS },
            total_leads: 0,
            funnel: { total: 0, new: 0, contacted: 0, interested: 0, send_info: 0, meeting_booked: 0, dead: 0, not_interested: 0 },
          };
        });

        const memberLeads: Record<string, LeadWithDetails[]> = {};
        (leads || []).forEach((lead) => {
          if (lead.assigned_to && memberMap[lead.assigned_to]) {
            memberMap[lead.assigned_to].leads_assigned += 1;
            memberMap[lead.assigned_to].total_leads += 1;
            memberMap[lead.assigned_to].leads_by_status[lead.status as keyof typeof EMPTY_STATUS] =
              (memberMap[lead.assigned_to].leads_by_status[lead.status as keyof typeof EMPTY_STATUS] || 0) + 1;
            if (!memberLeads[lead.assigned_to]) memberLeads[lead.assigned_to] = [];
            memberLeads[lead.assigned_to].push(lead);
          }
        });

        Object.keys(memberMap).forEach((id) => {
          memberMap[id].funnel = computeFunnel(memberLeads[id] || []);
        });

        const memberArray = Object.values(memberMap).sort((a, b) => b.leads_assigned - a.leads_assigned);
        setMemberStats(memberArray);

        const totalLeads = leads?.length || 1;
        const statusDist: StatusDistribution[] = Object.entries(statusCounts)
          .filter(([_, count]) => count > 0)
          .map(([status, count]) => ({
            status: status as keyof typeof EMPTY_STATUS,
            count,
            percentage: totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0,
          }));
        setStatusDistribution(statusDist);

        const sourceCounts: Record<string, number> = {};
        (leads || []).forEach((lead) => {
          const src = lead.source || 'unknown';
          sourceCounts[src] = (sourceCounts[src] || 0) + 1;
        });
        const sourceDist: SourceDistribution[] = Object.entries(sourceCounts)
          .map(([source, count]) => ({
            source,
            count,
            percentage: totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0,
          }))
          .sort((a, b) => b.count - a.count);
        setSourceDistribution(sourceDist);
      } else {
        setMemberStats([]);
        setStatusDistribution([]);
        setSourceDistribution([]);
        setPersonalFunnel(computeFunnel(leads || []));
      }
    } catch (err: any) {
      console.error('Error fetching analytics:', err);
      setError('Failed to load analytics data.');
    } finally {
      setLoading(false);
    }
  };

  const STATUS_COLORS_MAP: Record<string, string> = {
    new: 'bg-gray-400', contacted: 'bg-blue-400', interested: 'bg-green-400',
    not_interested: 'bg-red-400', send_info: 'bg-yellow-400',
    meeting_booked: 'bg-purple-400', dead: 'bg-gray-600',
  };

  const STATUS_LABELS_MAP: Record<string, string> = {
    new: 'New', contacted: 'Contacted', interested: 'Interested',
    not_interested: 'Not Interested', send_info: 'Send Info',
    meeting_booked: 'Meeting Booked', dead: 'Dead',
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
      <AnalyticsHeader
        isAdmin={isAdmin}
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        leadsCount={memberStats.reduce((sum, m) => sum + m.leads_assigned, 0) || (personalFunnel?.total || 0)}
      />

      {/* Team Performance Cards */}
      {isAdmin && memberStats.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-gray-400" />
            Team Performance
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {memberStats.map((member) => (
              <TeamPerformanceCard key={member.id} member={member} allFunnelData={member.funnel} />
            ))}
          </div>
        </div>
      )}

      {/* Team Conversion Funnel */}
      {isAdmin && memberStats.length > 0 && (
        <TeamConversionFunnel memberStats={memberStats} />
      )}

      {/* Member Personal Stats */}
      {!isAdmin && (
        <MemberFunnel funnel={personalFunnel || {
          total: 0, new: 0, contacted: 0, interested: 0,
          send_info: 0, meeting_booked: 0, dead: 0, not_interested: 0,
        }} />
      )}

      {/* Admin Status Distribution */}
      {isAdmin && statusDistribution.length > 0 && (
        <DistributionSection
          title="Lead Status Distribution"
          items={statusDistribution}
          renderBar={(item) => (
            <BarWithColor
              label={STATUS_LABELS_MAP[item.status] || item.status}
              count={item.count}
              percentage={item.percentage}
              colorClass={STATUS_COLORS_MAP[item.status] || 'bg-gray-400'}
            />
          )}
        />
      )}

      {/* Admin Source Distribution */}
      {isAdmin && sourceDistribution.length > 0 && (
        <DistributionSection
          title="Lead Source Distribution"
          items={sourceDistribution}
          renderBar={(item) => (
            <BarWithColor
              label={item.source.replace('_', ' ')}
              count={item.count}
              percentage={item.percentage}
              colorClass="bg-blue-500"
            />
          )}
        />
      )}

      {/* Activity Log */}
      <ActivityLogList
        title={isAdmin ? 'Team Activity Log' : 'Recent Activity'}
        description={
          isAdmin
            ? 'Recent lead assignments across your team.'
            : 'Recent leads assigned to you by admins and your activity.'
        }
        activityLog={activityLog}
        leadsReceivedLog={leadsReceivedLog}
        showReceived={!isAdmin}
      />
    </div>
  );
}

function DistributionSection<T>({ title, items, renderBar }: {
  title: string;
  items: T[];
  renderBar: (item: T) => React.ReactNode;
}) {
  return (
    <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-5">
      <h2 className="text-lg font-semibold text-white mb-4">{title}</h2>
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={idx}>{renderBar(item)}</div>
        ))}
      </div>
    </div>
  );
}

function BarWithColor({
  label, count, percentage, colorClass
}: { label: string; count: number; percentage: number; colorClass: string }) {
  return (
    <div key={label}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-300">{label}</span>
        <span className="text-sm text-gray-400">{count} ({percentage}%)</span>
      </div>
      <div className="w-full bg-[#27272a] rounded-full h-2">
        <div className={`h-2 rounded-full ${colorClass}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
