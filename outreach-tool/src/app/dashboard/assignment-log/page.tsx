'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { type Profile, type Lead } from '@/lib/types';
import Link from 'next/link';

interface AssignmentLogEntry {
  id: string;
  lead_id: string;
  lead_title: string;
  assigned_by_name: string | null;
  assigned_by_email: string | null;
  assigned_to_name: string | null;
  assigned_to_email: string | null;
  assigned_at: string;
  notes: string | null;
}

export default function AssignmentLogPage() {
  const [logEntries, setLogEntries] = useState<AssignmentLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});

  useEffect(() => {
    fetchAssignmentLog();
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    const { data, error: profilesError } = await supabase.from('profiles').select('*');
    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
    } else if (data) {
      const profileMap: Record<string, Profile> = {};
      data.forEach((p) => {
        profileMap[p.id] = p;
      });
      setProfiles(profileMap);
    }
  };

  const fetchAssignmentLog = async () => {
    setLoading(true);
    setError(null);

    // Fetch leads with assignment data, ordered by assigned_at descending
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, title, assigned_to, assigned_at, notes, owner_id')
      .not('assigned_to', 'is', null)
      .order('assigned_at', { ascending: false })
      .limit(200);

    if (leadsError) {
      console.error('Error fetching assignment log:', leadsError);
      setError('Failed to load assignment log. Please try again.');
      setLoading(false);
      return;
    }

    if (!leads) {
      setLogEntries([]);
      setLoading(false);
      return;
    }

    // Transform into log entries
    const entries: AssignmentLogEntry[] = leads.map((lead) => ({
      id: lead.id,
      lead_id: lead.id,
      lead_title: lead.title || 'Untitled Business',
      assigned_by_name: null, // Will be enriched below
      assigned_by_email: null,
      assigned_to_name: null,
      assigned_to_email: null,
      assigned_at: lead.assigned_at || '',
      notes: lead.notes || null,
    }));

    // Enrich with assigned_to profile data
    const assignedToIds = [...new Set(leads.map((l) => l.assigned_to).filter(Boolean))];
    if (assignedToIds.length > 0) {
      const { data: assignedToProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', assignedToIds as string[]);

      if (!profilesError && assignedToProfiles) {
        const profileMap = new Map(assignedToProfiles.map((p) => [p.id, p]));
        entries.forEach((entry) => {
          const profile = profileMap.get(leads.find((l) => l.id === entry.lead_id)?.assigned_to || '');
          if (profile) {
            entry.assigned_to_name = profile.full_name;
            entry.assigned_to_email = profile.email;
          }
        });
      }
    }

    setLogEntries(entries);
    setLoading(false);
  };

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
            {logEntries.length} assignment{logEntries.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <button
          onClick={fetchAssignmentLog}
          className="bg-[#3f3f46] hover:bg-[#52525b] text-white text-sm font-medium rounded-lg px-4 py-2 transition flex items-center gap-2"
        >
          Refresh
        </button>
      </div>

      {logEntries.length === 0 ? (
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#27272a]">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Lead</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Assigned To</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Notes</th>
                </tr>
              </thead>
              <tbody>
                {logEntries.map((entry) => (
                  <tr key={entry.id} className="border-b border-[#27272a] last:border-0 hover:bg-[#1f1f25] transition">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/leads/${entry.lead_id}`}
                        className="text-blue-400 hover:text-blue-300 font-medium"
                      >
                        {entry.lead_title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-200">
                      {entry.assigned_to_name || entry.assigned_to_email || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {formatDate(entry.assigned_at)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate">
                      {entry.notes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
