'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { type Profile } from '@/lib/types';
import Spinner from '@/components/ui/spinner';
import { useAuth } from '@/lib/auth-context';
import { ChevronDown, ChevronRight, Calendar, User } from 'lucide-react';

interface DateGroup {
  date: string; // ISO date string (e.g., "2026-10-14")
  display: string; // formatted for display
  leadIds: string[];
  count: number;
  latestAssignment: string;
  latestAssignedByName: string | null;
  latestAssignedByEmail: string | null;
}

interface AssigneeGroup {
  assigneeId: string;
  assigneeName: string | null;
  assigneeEmail: string | null;
  dateGroups: DateGroup[];
  totalLeads: number;
}

export default function AssignmentLogPage() {
  const { user } = useAuth();
  const [assigneeGroups, setAssigneeGroups] = useState<AssigneeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState<string | null>(null);
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [assigneeLeads, setAssigneeLeads] = useState<Record<string, any[]>>({});
  const [loadingLeads, setLoadingLeads] = useState<Record<string, boolean>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [dateFilter, setDateFilter] = useState<string>('all');

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    const { data, error: profilesError } = await supabase.from('profiles').select('*');
    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
    } else if (data) {
      const profileMap: Record<string, Profile> = {};
      data.forEach((p) => { profileMap[p.id] = p; });
      setProfiles(profileMap);
      const currentProfile = data.find(p => p.id === user?.id);
      setIsAdmin(currentProfile?.role === 'admin');
    }
    setProfilesLoaded(true);
  };

  useEffect(() => {
    if (profilesLoaded) {
      fetchAssignmentLog();
    }
  }, [profilesLoaded, dateFilter]);

  const fetchAssignmentLog = async () => {
    setLoading(true);
    setError(null);

    let leadsQuery = supabase
      .from('leads')
      .select('id, title, assigned_to, assigned_at, assigned_by, notes')
      .not('assigned_to', 'is', null)
      .order('assigned_at', { ascending: false })
      .limit(500);

    if (!isAdmin && user?.id) {
      leadsQuery = leadsQuery.eq('assigned_to', user.id);
    }

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

    if (leadsError) {
      console.error('Error fetching assignment log:', leadsError);
      setError('Failed to load assignment log. Please try again.');
      setLoading(false);
      return;
    }

    if (!leads) {
      setAssigneeGroups([]);
      setLoading(false);
      return;
    }

    // Group by assignee, then by date
    const groups: Record<string, { dates: Record<string, DateGroup> }> = {};
    const seenLeads: Record<string, Record<string, Set<string>>> = {};

    leads.forEach((lead) => {
      if (!lead.assigned_to || !lead.assigned_at) return;
      const assigneeKey = lead.assigned_to;
      const dateKey = new Date(lead.assigned_at).toISOString().split('T')[0]; // YYYY-MM-DD

      if (!groups[assigneeKey]) {
        groups[assigneeKey] = { dates: {} };
        seenLeads[assigneeKey] = {};
      }
      if (!seenLeads[assigneeKey][dateKey]) {
        seenLeads[assigneeKey][dateKey] = new Set();
      }

      // Deduplicate by title within each assignee+date group
      const title = lead.title || 'Untitled Business';
      if (seenLeads[assigneeKey][dateKey].has(title)) return;
      seenLeads[assigneeKey][dateKey].add(title);

      if (!groups[assigneeKey].dates[dateKey]) {
        const assignedByProfile = profiles[lead.assigned_by || ''];
        groups[assigneeKey].dates[dateKey] = {
          date: dateKey,
          display: new Date(lead.assigned_at).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }),
          leadIds: [],
          count: 0,
          latestAssignment: lead.assigned_at,
          latestAssignedByName: assignedByProfile?.full_name || null,
          latestAssignedByEmail: assignedByProfile?.email || null,
        };
      }
      groups[assigneeKey].dates[dateKey].count += 1;
      groups[assigneeKey].dates[dateKey].leadIds.push(lead.id);
      if (lead.assigned_at && lead.assigned_at > groups[assigneeKey].dates[dateKey].latestAssignment) {
        groups[assigneeKey].dates[dateKey].latestAssignment = lead.assigned_at;
        const assignedByProfile = profiles[lead.assigned_by || ''];
        groups[assigneeKey].dates[dateKey].latestAssignedByName = assignedByProfile?.full_name || null;
        groups[assigneeKey].dates[dateKey].latestAssignedByEmail = assignedByProfile?.email || null;
      }
    });

    // Convert to array structure
    const groupsArray: AssigneeGroup[] = Object.entries(groups).map(([assigneeId, data]) => {
      const profile = profiles[assigneeId];
      const dateGroups = Object.values(data.dates).sort((a, b) =>
        b.date.localeCompare(a.date)
      );
      return {
        assigneeId,
        assigneeName: profile?.full_name || null,
        assigneeEmail: profile?.email || null,
        dateGroups,
        totalLeads: dateGroups.reduce((sum, dg) => sum + dg.count, 0),
      };
    }).sort((a, b) => b.totalLeads - a.totalLeads);

    setAssigneeGroups(groupsArray);
    setLoading(false);
  };

  const fetchAssigneeLeads = async (assigneeId: string) => {
    let leadsQuery = supabase
      .from('leads')
      .select('id, title, assigned_at, assigned_by, notes')
      .eq('assigned_to', assigneeId)
      .order('assigned_at', { ascending: false })
      .limit(500);

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

    if (leadsError) {
      console.error('Error fetching assignee leads:', leadsError);
      return [];
    }
    const seen = new Set<string>();
    const deduplicated = (leads || []).filter(lead => {
      const title = lead.title || 'Untitled Business';
      if (seen.has(title)) return false;
      seen.add(title);
      return true;
    });
    return deduplicated;
  };

  const loadAssigneeLeads = async (assigneeId: string) => {
    if (assigneeLeads[assigneeId]) {
      setSelectedAssignee(selectedAssignee === assigneeId ? null : assigneeId);
      return;
    }
    setLoadingLeads((prev) => ({ ...prev, [assigneeId]: true }));
    const leads = await fetchAssigneeLeads(assigneeId);
    setAssigneeLeads((prev) => ({ ...prev, [assigneeId]: leads }));
    setLoadingLeads((prev) => ({ ...prev, [assigneeId]: false }));
    setSelectedAssignee(assigneeId);
  };

  // Clear cached data when date filter changes
  useEffect(() => {
    setAssigneeLeads({});
    setSelectedAssignee(null);
    setExpandedDates({});
  }, [dateFilter]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  const toggleDate = (assigneeId: string, dateKey: string) => {
    setExpandedDates((prev) => ({ ...prev, [`${assigneeId}-${dateKey}`]: !prev[`${assigneeId}-${dateKey}`] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex items-center gap-3 text-gray-500">
          <Spinner size="md" />
          <span>Loading assignment log...</span>
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Assignment Log</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {assigneeGroups.length} team member{assigneeGroups.length !== 1 ? 's' : ''} with assigned leads
          </p>
        </div>
        {!isAdmin && (
          <div className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-1.5">
            Member View
          </div>
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

      {assigneeGroups.length === 0 ? (
        <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-12">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-[#27272a] flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-2 2l2-2-2-2M9 12l2 2 2-2" />
              </svg>
            </div>
            <p className="text-gray-300 font-medium mb-1">No assignments yet</p>
            <p className="text-gray-500 text-sm">Assign leads to team members to see the log here.</p>
          </div>
        </div>
      ) : (
        <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#27272a]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Team Member</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Leads Assigned</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Assignment</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Assigned By</th>
              </tr>
            </thead>
            <tbody>
              {assigneeGroups.map((group) => (
                <tr key={group.assigneeId}>
                  <td className="px-4 py-3 text-gray-200">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      {group.assigneeName || group.assigneeEmail || 'Unknown'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{group.totalLeads}</span>
                      <button
                        onClick={() => loadAssigneeLeads(group.assigneeId)}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        {selectedAssignee === group.assigneeId ? 'Hide' : 'Show dates'}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {group.dateGroups.length > 0 ? formatDate(group.dateGroups[0].latestAssignment) : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-200">
                    {group.dateGroups.length > 0 ? (group.dateGroups[0].latestAssignedByName || group.dateGroups[0].latestAssignedByEmail || '-') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {selectedAssignee && (
            <div className="border-t border-[#27272a]">
              <div className="px-4 py-3 bg-[#27272a]/30 border-b border-[#27272a]">
                <h3 className="text-sm font-medium text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Assignment dates for {assigneeGroups.find(g => g.assigneeId === selectedAssignee)?.assigneeName || 'Unknown'}
                </h3>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {loadingLeads[selectedAssignee] ? (
                  <div className="p-4 flex items-center justify-center gap-3 text-gray-500 text-sm">
                    <Spinner size="sm" />
                    <span>Loading dates...</span>
                  </div>
                ) : (
                  (() => {
                    const selGroup = assigneeGroups.find(g => g.assigneeId === selectedAssignee);
                    if (!selGroup || selGroup.dateGroups.length === 0) {
                      return <div className="p-4 text-gray-500 text-sm">No dates found</div>;
                    }
                    return selGroup.dateGroups.map((dateGroup) => {
                      const dateKey = `${selectedAssignee}-${dateGroup.date}`;
                      const isExpanded = expandedDates[dateKey];
                      return (
                        <div key={dateKey}>
                          <button
                            onClick={() => toggleDate(selectedAssignee, dateGroup.date)}
                            className="w-full px-4 py-3 flex items-center gap-2 hover:bg-[#1f1f25] transition text-left"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            )}
                            <span className="text-sm font-medium text-white">{dateGroup.display}</span>
                            <span className="text-xs text-gray-500">({dateGroup.count} leads)</span>
                          </button>
                          {isExpanded && (
                            <div className="border-t border-[#27272a] bg-[#0f0f0f]/30">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-[#27272a]">
                                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Lead</th>
                                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Assigned By</th>
                                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {dateGroup.leadIds.map((leadId) => {
                                    const lead = (assigneeLeads[selectedAssignee] || []).find(l => l.id === leadId);
                                    const assignedByProfile = lead ? profiles[lead.assigned_by || ''] : null;
                                    return (
                                      <tr key={leadId} className="border-b border-[#27272a] last:border-0 hover:bg-[#1f1f25] transition">
                                        <td className="px-4 py-3">
                                          {lead ? (
                                            <a
                                              href={`/dashboard/leads/${lead.id}`}
                                              className="text-blue-400 hover:text-blue-300 font-medium"
                                            >
                                              {lead.title || 'Untitled Business'}
                                            </a>
                                          ) : (
                                            <span className="text-gray-500">Loading...</span>
                                          )}
                                        </td>
                                        <td className="px-4 py-3 text-gray-200">
                                          {assignedByProfile?.full_name || assignedByProfile?.email || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 text-xs">
                                          {lead ? formatDate(lead.assigned_at) : '-'}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
