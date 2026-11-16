'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { authFetch } from '@/lib/auth-fetch';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { Trash2, RotateCcw, Users, Search } from 'lucide-react';
import Spinner from '@/components/ui/spinner';

// A deleted lead can come from two different tables: the main `leads` table
// (Google Maps, manual, CSV) and `linkedin_leads` (enriched contacts). Archiving
// on one page writes only to its own table, so this screen reads both and
// labels each row with where it came from.
type SourceFilter = 'all' | 'google_maps' | 'linkedin';

interface DeletedLead {
  id: string;
  /** Table the row lives in, which decides how restore and delete behave. */
  lead_table: 'leads' | 'linkedin_leads';
  title: string | null;
  subtitle: string | null;
  email: string | null;
  deleted_at: string | null;
  created_at: string;
}

export default function DeletedLeadsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[300px]"><Spinner size="md" /></div>}>
      <DeletedLeadsInner />
    </Suspense>
  );
}

function DeletedLeadsInner() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  // The LinkedIn page links here with ?filter=linkedin, so the view opens
  // already scoped to that source instead of everything.
  const requestedFilter = searchParams.get('filter');
  const initialFilter: SourceFilter =
    requestedFilter === 'linkedin' || requestedFilter === 'google_maps'
      ? requestedFilter
      : 'all';

  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<DeletedLead[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>(initialFilter);
  const [searchQuery, setSearchQuery] = useState('');

  // Selection keys combine table + id, because a lead and a LinkedIn contact can
  // share an id-looking value and must never be treated as the same row.
  const keyFor = (row: Pick<DeletedLead, 'lead_table' | 'id'>) => `${row.lead_table}:${row.id}`;

  const fetchDeleted = useCallback(async () => {
    setLoading(true);

    // Both queries run in parallel: they are independent tables.
    const [mapsRes, linkedInRes] = await Promise.all([
      supabase
        .from('leads')
        .select('id, title, city, deleted_at, created_at')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false }),
      supabase
        .from('linkedin_leads')
        .select('id, lead_name, title, email, deleted_at, created_at')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false }),
    ]);

    if (mapsRes.error) console.error(mapsRes.error);
    if (linkedInRes.error) console.error(linkedInRes.error);

    const mapsRows: DeletedLead[] = (mapsRes.data ?? []).map((row: {
      id: string;
      title: string | null;
      city: string | null;
      deleted_at: string | null;
      created_at: string;
    }) => ({
      id: row.id,
      lead_table: 'leads',
      title: row.title || 'Untitled Lead',
      subtitle: row.city || null,
      email: null,
      deleted_at: row.deleted_at,
      created_at: row.created_at,
    }));

    const linkedInRows: DeletedLead[] = (linkedInRes.data ?? []).map((row: {
      id: string;
      lead_name: string | null;
      title: string | null;
      email: string | null;
      deleted_at: string | null;
      created_at: string;
    }) => ({
      id: row.id,
      lead_table: 'linkedin_leads',
      title: row.lead_name || 'Untitled Contact',
      subtitle: row.title || null,
      email: row.email || null,
      deleted_at: row.deleted_at,
      created_at: row.created_at,
    }));

    setLeads([...mapsRows, ...linkedInRows]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchDeleted(); }, [fetchDeleted]);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const filtered = leads.filter((lead) => {
    if (sourceFilter === 'google_maps' && lead.lead_table !== 'leads') return false;
    if (sourceFilter === 'linkedin' && lead.lead_table !== 'linkedin_leads') return false;

    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      lead.title?.toLowerCase().includes(q) ||
      lead.subtitle?.toLowerCase().includes(q) ||
      lead.email?.toLowerCase().includes(q)
    );
  });

  const allSelected = filtered.length > 0 && filtered.every((l) => selected.has(keyFor(l)));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map(keyFor)));
  };

  const logActivity = async (rows: DeletedLead[], content: string) => {
    // profile_id is NOT NULL on lead_activities and has a FK to auth.users.
    // Passing null made every one of these inserts fail silently, so restores
    // and permanent deletes never appeared in the activity feed.
    if (!user?.id) return;

    await Promise.all(rows.map((row) => supabase.from('lead_activities').insert({
      lead_id: row.id,
      profile_id: user.id,
      activity_type: 'other',
      content,
      lead_table: row.lead_table,
    })));
  };

  const splitSelection = (): DeletedLead[] =>
    leads.filter((row) => selected.has(keyFor(row)));

  const applyToEachTable = async <T,>(
    rows: DeletedLead[],
    fn: (table: DeletedLead['lead_table'], ids: string[]) => Promise<{ error: { message: string } | null }>,
  ): Promise<string | null> => {
    const byTable = new Map<DeletedLead['lead_table'], string[]>();
    for (const row of rows) {
      const list = byTable.get(row.lead_table) ?? [];
      list.push(row.id);
      byTable.set(row.lead_table, list);
    }

    let firstError: string | null = null;
    for (const [table, ids] of byTable) {
      // Chunk so a large selection cannot overflow the query string.
      for (let i = 0; i < ids.length; i += 200) {
        const { error } = await fn(table, ids.slice(i, i + 200));
        if (error && !firstError) firstError = error.message;
      }
    }
    return firstError;
  };

  const bulkRestore = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Restore ${selected.size} lead(s)?`)) return;
    setBusy(true);
    const rows = splitSelection();

    const error = await applyToEachTable(rows, async (table, ids) => {
      const target = table === 'linkedin_leads'
        ? supabase.from('linkedin_leads')
        : supabase.from('leads');
      return await target.update({ deleted_at: null }).in('id', ids);
    });

    setBusy(false);
    if (error) { alert('Failed: ' + error); return; }
    await logActivity(rows, 'Lead restored');
    setSelected(new Set());
    await fetchDeleted();
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Permanently delete ${selected.size} lead(s)? Cannot be undone.`)) return;
    setBusy(true);
    const rows = splitSelection();

    // Main-table leads go through the graph-delete route (call logs, activities,
    // assignment history). LinkedIn contacts are a single-table delete because
    // they have no child rows beyond their own activities.
    const mapsIds = rows.filter((r) => r.lead_table === 'leads').map((r) => r.id);
    let error: string | null = null;

    if (mapsIds.length > 0) {
      const res = await authFetch('/api/leads/permanent-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: mapsIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) error = data.error || 'Could not delete leads.';
    }

    if (!error) {
      const chunkError = await applyToEachTable(
        rows.filter((r) => r.lead_table === 'linkedin_leads'),
        async (_table, ids) => await supabase.from('linkedin_leads').delete().in('id', ids),
      );
      if (chunkError) error = chunkError;
    }

    setBusy(false);
    if (error) { alert('Failed: ' + error); return; }
    await logActivity(rows, 'Lead permanently deleted');
    setSelected(new Set());
    await fetchDeleted();
  };

  const restore = async (row: DeletedLead) => {
    const target = row.lead_table === 'linkedin_leads'
      ? supabase.from('linkedin_leads')
      : supabase.from('leads');
    const { error } = await target.update({ deleted_at: null }).eq('id', row.id);
    if (error) { alert('Failed: ' + error.message); return; }
    await logActivity([row], 'Lead restored');
    await fetchDeleted();
  };

  const permanentDelete = async (row: DeletedLead) => {
    if (!confirm('Permanently delete? Cannot be undone.')) return;

    if (row.lead_table === 'linkedin_leads') {
      const { error } = await supabase.from('linkedin_leads').delete().eq('id', row.id);
      if (error) { alert('Failed: ' + error.message); return; }
      await logActivity([row], 'Lead permanently deleted');
      await fetchDeleted();
      return;
    }

    const res = await authFetch('/api/leads/permanent-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadIds: [row.id] }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { alert('Failed: ' + (data.error || 'Could not delete')); return; }
    await logActivity([row], 'Lead permanently deleted');
    await fetchDeleted();
  };

  const counts = {
    maps: leads.filter((l) => l.lead_table === 'leads').length,
    linkedIn: leads.filter((l) => l.lead_table === 'linkedin_leads').length,
  };

  if (loading) return <div className="flex items-center justify-center min-h-[300px]"><Spinner size="md" /></div>;

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Deleted Leads</h1>
          <p className="text-sm text-muted mt-1">Archived Google Maps and LinkedIn leads. Restore or permanently delete.</p>
        </div>
        <Link href="/dashboard" className="text-sm text-accent hover:underline">Back to Leads</Link>
      </div>

      {/* Filters */}
      <div className="bg-secondary border border-border rounded-xl p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, title, or email..."
              className="w-full bg-card border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition [&>option]:bg-secondary"
            />
          </div>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
            className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition [&>option]:bg-secondary [&>option]:text-foreground"
          >
            <option value="all">All Sources ({leads.length})</option>
            <option value="google_maps">Google Maps ({counts.maps})</option>
            <option value="linkedin">LinkedIn ({counts.linkedIn})</option>
          </select>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 bg-secondary border border-border rounded-xl px-4 py-2.5">
          <span className="text-sm text-muted"><span className="font-medium text-foreground">{selected.size}</span> selected</span>
          <button onClick={bulkRestore} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-400 hover:bg-green-500/10 rounded-lg transition disabled:opacity-50">
            <RotateCcw className="w-4 h-4" /> Restore
          </button>
          <button onClick={bulkDelete} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/10 rounded-lg transition disabled:opacity-50">
            <Trash2 className="w-4 h-4" /> Delete Forever
          </button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-sm text-muted hover:text-foreground">Clear</button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-8 h-8 text-muted mx-auto mb-3" />
          <p className="text-muted">
            {leads.length === 0 ? 'No deleted leads' : 'No leads match this filter'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-muted px-1">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="accent-primary"
            />
            Select all
          </label>
          {filtered.map((lead) => {
            const key = keyFor(lead);
            return (
              <div key={key} className="bg-secondary border border-border rounded-xl p-4 flex items-center gap-4">
                <input
                  type="checkbox"
                  checked={selected.has(key)}
                  onChange={() => toggle(key)}
                  className="accent-primary shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-foreground text-base truncate">{lead.title}</h3>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                      lead.lead_table === 'linkedin_leads'
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : 'bg-primary/20 text-accent border border-primary/30'
                    }`}>
                      {lead.lead_table === 'linkedin_leads' ? 'LinkedIn' : 'Google Maps'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted mt-1">
                    {lead.subtitle && <span>{lead.subtitle}</span>}
                    {lead.email && <span>{lead.email}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => restore(lead)} className="text-muted hover:text-green-400 transition p-1" title="Restore"><RotateCcw className="w-4 h-4" /></button>
                  <button onClick={() => permanentDelete(lead)} className="text-muted hover:text-red-400 transition p-1" title="Permanent delete"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
