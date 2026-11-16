'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { type Profile } from '@/lib/types';
import Spinner from '@/components/ui/spinner';
import { useAuth } from '@/lib/auth-context';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface HistoryEntry {
  id: string;
  /** Exactly one of lead_id / linkedin_lead_id is set, enforced by a check. */
  lead_id: string | null;
  linkedin_lead_id: string | null;
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

const PAGE_SIZE = 500;

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
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

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
      .select('id, lead_id, linkedin_lead_id, assigned_to, assigned_by, assigned_at, previous_assignee, notes')
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
    const leadIds = [...new Set(
      rows.flatMap((r) => [r.lead_id, r.linkedin_lead_id]).filter(Boolean),
    )] as string[];
    const [mapsRes, linkedInRes] = await Promise.all([
      supabase.from('leads').select('id, title').in('id', leadIds),
      supabase.from('linkedin_leads').select('id, lead_name').in('id', leadIds),
    ]);

    const mapsById = new Map((mapsRes.data ?? []).map((l: { id: string; title: string | null }) => [l.id, l.title]));
    const linkedInById = new Map((linkedInRes.data ?? []).map((l: { id: string; lead_name: string | null }) => [l.id, l.lead_name]));

    const enriched: EnrichedEntry[] = rows.map((row) => {
      const inMaps = Boolean(row.lead_id && mapsById.has(row.lead_id));
      return {
        ...row,
        leadTitle: inMaps ? mapsById.get(row.lead_id!) ?? null : linkedInById.get(row.linkedin_lead_id!) ?? null,
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
  }, [loadingRole, dateFilter, sourceFilter]);

  // Group by calendar day. Assigning 100 leads in one go must produce one row,
  // not 100.
  const groups = useMemo(() => {
    const byDay = new Map<string, EnrichedEntry[]>();
    entries.forEach((entry) => {
      const key = entry.assigned_at
        ? new Date(entry.assigned_at).toLocaleDateString(undefined, {
            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
          })
        : 'Unknown date';
      const list = byDay.get(key) ?? [];
      list.push(entry);
      byDay.set(key, list);
    });
    // Newest first: sort by the newest entry inside each day.
    return Array.from(byDay.entries())
      .map(([day, items]) => ({ day, items, latest: items[0]?.assigned_at ?? '' }))
      .sort((a, b) => (a.latest < b.latest ? 1 : -1));
  }, [entries]);

  const nameFor = (id: string | null) => {
    if (!id) return '-';
    const profile = profiles[id];
    if (!profile) return 'Former member';
    return profile.full_name || profile.email || 'Former member';
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
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
            Every lead assignment, grouped by day. Reassignments are kept, not overwritten.
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
      ) : groups.length === 0 ? (
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
        <div className="space-y-3">
          {groups.map((group) => {
            const isOpen = expandedDates[group.day] ?? false;
            const assignees = Array.from(new Set(group.items.map((i) => i.assigned_to)));
            const sources = Array.from(new Set(group.items.map((i) => i.leadTable)));

            return (
              <div key={group.day} className="bg-secondary border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedDates((prev) => ({ ...prev, [group.day]: !isOpen }))}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-[#1f1f25] transition"
                >
                  <div className="flex items-center gap-3">
                    {isOpen
                      ? <ChevronDown className="w-4 h-4 text-muted shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-muted shrink-0" />}
                    <div>
                      <p className="text-sm font-medium text-foreground">{group.day}</p>
                      <p className="text-xs text-muted mt-0.5">
                        {group.items.length} assignment{group.items.length !== 1 ? 's' : ''}
                        {' · '}
                        {assignees.length === 1
                          ? `to ${nameFor(assignees[0])}`
                          : `to ${assignees.length} members`}
                        {' · '}
                        {sources.length === 1
                          ? (sources[0] === 'linkedin_leads' ? 'LinkedIn' : 'Google Maps')
                          : `${sources.length} sources`}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-muted">{group.latest ? formatTime(group.latest) : ''}</span>
                </button>

                {isOpen && (
                  <div className="border-t border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left px-4 py-2 text-xs font-semibold text-muted uppercase tracking-wider">Lead</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-muted uppercase tracking-wider">Source</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-muted uppercase tracking-wider">Assigned To</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-muted uppercase tracking-wider">Previous</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-muted uppercase tracking-wider">Assigned By</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-muted uppercase tracking-wider">Time</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-muted uppercase tracking-wider">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map((entry) => (
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
                              {formatTime(entry.assigned_at)}
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
          })}
        </div>
      )}
    </div>
  );
}
