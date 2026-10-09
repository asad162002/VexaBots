'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { type Profile } from '@/lib/types';

interface AssigneeGroup {
  assigneeId: string;
  assigneeName: string | null;
  assigneeEmail: string | null;
  leadCount: number;
  latestAssignment: string;
  notes: string | null;
}

export default function AssignmentLogPage() {
  const [assigneeGroups, setAssigneeGroups] = useState<AssigneeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [selectedGroup, setSelectedGroup] = useState<AssigneeGroup | null>(null);
  const [assigneeLeads, setAssigneeLeads] = useState<Record<string, any[]>>({});
  const [loadingLeads, setLoadingLeads] = useState<Record<string, boolean>>({});

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
    }
  };

  const fetchAssignmentLog = async () => {
    setLoading(true);
    setError(null);

    // Fetch leads with assignment data
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, title, assigned_to, assigned_at, notes')
      .not('assigned_to', 'is', null)
      .order('assigned_at', { ascending: false })
      .limit(500);

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

    // Group by assignee
    const groups: Record<string, AssigneeGroup> = {};
    leads.forEach((lead) => {
      if (!lead.assigned_to) return;
      const key = lead.assigned_to;
      if (!groups[key]) {
        groups[key] = {
          assigneeId: key,
          assigneeName: null,
          assigneeEmail: null,
          leadCount: 0,
          latestAssignment: lead.assigned_at || '',
          notes: lead.notes || null,
        };
      }
      groups[key].leadCount += 1;
      // Track the latest assignment date (already sorted desc)
      if (lead.assigned_at && (!groups[key].latestAssignment || lead.assigned_at > groups[key].latestAssignment)) {
        groups[key].latestAssignment = lead.assigned_at;
      }
      // Use the most recent non-empty notes
      if (lead.notes && !groups[key].notes) {
        groups[key].notes = lead.notes;
      }
    });

    // Enrich with profile data (from state)
    const groupsArray: AssigneeGroup[] = Object.values(groups).map((group) => {
      const profile = profiles[group.assigneeId];
      if (profile) {
        group.assigneeName = profile.full_name;
        group.assigneeEmail = profile.email;
      }
      return group;
    });

    setAssigneeGroups(groupsArray);
    setLoading(false);
  };

  const fetchAssigneeLeads = async (assigneeId: string) => {
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, title, assigned_at, notes')
      .eq('assigned_to', assigneeId)
      .order('assigned_at', { ascending: false })
      .limit(100);

    if (leadsError) {
      console.error('Error fetching assignee leads:', leadsError);
      return [];
    }
    return leads || [];
  };

  const loadAssigneeLeads = async (group: AssigneeGroup) => {
    if (assigneeLeads[group.assigneeId]) {
      setSelectedGroup(selectedGroup?.assigneeId === group.assigneeId ? null : group);
      return;
    }
    setLoadingLeads((prev) => ({ ...prev, [group.assigneeId]: true }));
    const leads = await fetchAssigneeLeads(group.assigneeId);
    setAssigneeLeads((prev) => ({ ...prev, [group.assigneeId]: leads }));
    setLoadingLeads((prev) => ({ ...prev, [group.assigneeId]: false }));
    setSelectedGroup(group);
  };

  // Re-run fetchAssignmentLog when profiles change (so enrichment works)
  useEffect(() => {
    if (Object.keys(profiles).length > 0) {
      fetchAssignmentLog();
    }
  }, [profiles]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-gray-500 text-sm">Loading assignment log...</div>
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
        <button
          onClick={fetchAssignmentLog}
          className="bg-[#3f3f46] hover:bg-[#52525b] text-white text-sm font-medium rounded-lg px-4 py-2 transition flex items-center gap-2"
        >
          Refresh
        </button>
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
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Notes</th>
              </tr>
            </thead>
            <tbody>
              {assigneeGroups.map((group) => (
                <tr key={group.assigneeId}>
                  <td className="px-4 py-3 text-gray-200">
                    {group.assigneeName || group.assigneeEmail || 'Unknown'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{group.leadCount}</span>
                      <button
                        onClick={() => loadAssigneeLeads(group)}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        {selectedGroup?.assigneeId === group.assigneeId ? 'Hide' : 'Show leads'}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {formatDate(group.latestAssignment)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate">
                    {group.notes || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {selectedGroup && (
            <div className="border-t border-[#27272a]">
              <div className="px-4 py-3 bg-[#27272a]/30 border-b border-[#27272a]">
                <h3 className="text-sm font-medium text-white">
                  Leads assigned to {selectedGroup.assigneeName || selectedGroup.assigneeEmail}
                </h3>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {loadingLeads[selectedGroup.assigneeId] ? (
                  <div className="p-4 text-center text-gray-500 text-sm">Loading...</div>
                ) : (
                  <table className="w-full text-sm">
                    <tbody>
                      {(assigneeLeads[selectedGroup.assigneeId] || []).map((lead) => (
                        <tr key={lead.id} className="border-b border-[#27272a] last:border-0 hover:bg-[#1f1f25]">
                          <td className="px-4 py-3">
                            <a
                              href={`/dashboard/leads/${lead.id}`}
                              className="text-blue-400 hover:text-blue-300 font-medium"
                            >
                              {lead.title || 'Untitled Business'}
                            </a>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {formatDate(lead.assigned_at)}
                          </td>
                          <td className="px-4 py-3 text-gray-500 max-w-xs truncate text-xs">
                            {lead.notes || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
