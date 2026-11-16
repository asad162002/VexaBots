'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { type Profile } from '@/lib/types';
import Spinner from '@/components/ui/spinner';
import { useAuth } from '@/lib/auth-context';

interface HistoryEntry {
  id: string;
  lead_id: string;
  assigned_to: string | null;
  assigned_by: string | null;
  assigned_at: string | null;
  previous_assignee: string | null;
  notes: string | null;
}

interface EnrichedEntry extends HistoryEntry {
  leadTitle: string | null;
  leadTable: 'leads' | 'linkedin_leads';
}

const PAGE_SIZE = 100;

export default function AssignmentLogPage() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingRole, setLoadingRole] = useState(true);

  const [entries, setEntries] = useState<EnrichedEntry[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'leads' | 'linkedin_leads'>('all');

  const fetchProfiles = async () => {
    const { data, error: profilesError } = await supabase.from('profiles').select('*');
    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
    } else if (data) {
      const profileMap: Record<string, Profile> = {};
      data.forEach((p) => { profileMap[p.id] = p; });
      setProfiles(profileMap);
      setIsAdmin(data.find((p) => p.id === user?.id)?.role === 'admin');
    }
    setLoadingRole(false);
  };

  // The log is assignment_history, which is append-only. Reading live leads
  // instead meant a reassignment erased the earlier one and deleting a lead
  // erased its whole history.
  const fetchLog = async () => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from('assignment_history')
      .select('id, lead_id, assigned_to, assigned_by, assigned_at, previous_assignee, notes')
      .order('assigned_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (!isAdmin && user?.id) {
      query = query.eq('assigned_to', user.id);
    }

    if (dateFilter !== 'all') {
      const now = new Date();
      const ms = dateFilter === '24h'
        ? 24 * 60 * 60 * 1000
        : dateFilter === '7d'
          ? 7 * 24 * 60 * 60 * 1000
          : 30 * 24 * 60 * 60 * 1000;
      query = query.gte('assigned_at', new Date(now.getTime() - ms).toISOString());
    }

    const { data, error: historyError } = await query;

    if (historyError) {
      console.error('Error fetching assignment log:', historyError);
      setError('Failed to load assignment log. Please try again.');
      setLoading(false);
      return;
    }

    const rows: HistoryEntry[] = data ?? [];

    // Resolve lead titles for both tables so a row reads correctly whether it
    // came from Google Maps or LinkedIn.
    const leadIds = [...new Set(rows.map((r) => r.lead_id))];
    const [mapsRes, linkedInRes] = await Promise.all([
      supabase.from('leads').select('id, title').in('id', leadIds),
      supabase.from('linkedin_leads').select('id, lead_name').in('id', leadIds),
    ]);

    const mapsById = new Map((mapsRes.data ?? []).map((l: { id: string; title: string | null }) => [l.id, l.title]));
    const linkedInById = new Map((linkedInRes.data ?? []).map((l: { id: string; lead_name: string | null }) => [l.id, l.lead_name]));

    const enriched: EnrichedEntry[] = rows.map((row) => {
      const inMaps = mapsById.has(row.lead_id);
      return {
        ...row,
        leadTitle: inMaps ? mapsById.get(row.lead_id) ?? null : linkedInById.get(row.lead_id) ?? null,
        leadTable: inMaps ? 'leads' : 'linkedin_leads',
      };
    });

    // Filtering by source happens after enrichment because the history table
    // does not record which table the lead came from.
    const visible = sourceFilter === 'all'
      ? enriched
      : enriched.filter((entry) => entry.leadTable === sourceFilter);

    setEntries(visible);
    setLoading(false);
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  useEffect(() => {
    if (loadingRole) return;
    fetchLog();
  }, [loadingRole, dateFilter, sourceFilter, isAdmin]);

  const nameFor = (id: string | null) => {
    if (!id) return '-';
    return profiles[id]?.full_name || profiles[id]?.email || 'Unknown';
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  const counts = {
    all: entries.length,
    leads: entries.filter((e) => e.leadTable === 'leads').length,
    linkedin: entries.filter((e) => e.leadTable === 'linkedin_leads').length,
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Assignment Log</h1>
          <p className="text-sm text-muted mt-0.5">
            Every lead assignment, newest first. Reassignments are kept, not overwritten.
          </p>
        </div>
        {!isAdmin && (
          <div className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-1.5">
            Showing assignments made to you
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as typeof sourceFilter)}
          className="px-3 py-1.5 bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary [&>option]:bg-secondary [&>option]:text-foreground"
        >
          <option value="all">All Sources ({counts.all})</option>
          <option value="leads">Google Maps ({counts.leads})</option>
          <option value="linkedin_leads">LinkedIn ({counts.linkedin})</option>
        </select>

        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="px-3 py-1.5 bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary [&>option]:bg-secondary [&>option]:text-foreground"
        >
          <option value="all">All Time</option>
          <option value="30d">Last 30 Days</option>
          <option value="7d">Last 7 Days</option>
          <option value="24h">Last 24 Hours</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-3 text-muted">
            <Spinner size="md" />
            <span>Loading assignment log...</span>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400">
          {error}
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-secondary border border-border rounded-xl p-12">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-card flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-2 2l2-2-2-2M9 12l2 2 2-2" />
              </svg>
            </div>
            <p className="text-muted font-medium mb-1">No assignments yet</p>
            <p className="text-muted text-sm">Assign leads to team members to see the log here.</p>
          </div>
        </div>
      ) : (
        <div className="bg-secondary border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Lead</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Source</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Assigned To</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Previous</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Assigned By</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">When</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Notes</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-border last:border-0 hover:bg-[#1f1f25] transition align-top">
                  <td className="px-4 py-3 text-foreground max-w-[220px] truncate">
                    {entry.leadTitle || 'Untitled'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${
                      entry.leadTable === 'linkedin_leads'
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : 'bg-primary/20 text-accent border border-primary/30'
                    }`}>
                      {entry.leadTable === 'linkedin_leads' ? 'LinkedIn' : 'Google Maps'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-foreground">{nameFor(entry.assigned_to)}</td>
                  <td className="px-4 py-3 text-muted">{nameFor(entry.previous_assignee)}</td>
                  <td className="px-4 py-3 text-foreground">{nameFor(entry.assigned_by)}</td>
                  <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">
                    {formatDate(entry.assigned_at)}
                  </td>
                  <td className="px-4 py-3 text-muted max-w-xs truncate" title={entry.notes ?? ''}>
                    {entry.notes || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
