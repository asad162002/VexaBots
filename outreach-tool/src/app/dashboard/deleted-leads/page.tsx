'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Trash2, RotateCcw, Users } from 'lucide-react';
import Spinner from '@/components/ui/spinner';

interface Lead { id: string; title: string | null; deleted_at: string | null; created_at: string; }

export default function DeletedLeadsPage() {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const fetchDeleted = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('leads')
      .select('id, title, deleted_at, created_at')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });
    if (error) console.error(error);
    else setLeads(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchDeleted(); }, [fetchDeleted]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const allSelected = leads.length > 0 && selected.size === leads.length;
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(leads.map((l) => l.id)));
  };

  const bulkRestore = async () => {
    if (!confirm(`Restore ${selected.size} lead(s)?`)) return;
    setBusy(true);
    const { error } = await supabase.from('leads').update({ deleted_at: null }).in('id', Array.from(selected));
    setBusy(false);
    if (error) { alert('Failed: ' + error.message); return; }
    setLeads((prev) => prev.filter((l) => !selected.has(l.id)));
    setSelected(new Set());
  };

  const bulkDelete = async () => {
    if (!confirm(`Permanently delete ${selected.size} lead(s)? Cannot be undone.`)) return;
    setBusy(true);
    const { error } = await supabase.from('leads').delete().in('id', Array.from(selected));
    setBusy(false);
    if (error) { alert('Failed: ' + error.message); return; }
    setLeads((prev) => prev.filter((l) => !selected.has(l.id)));
    setSelected(new Set());
  };

  const restore = async (id: string) => {
    const { error } = await supabase.from('leads').update({ deleted_at: null }).eq('id', id);
    if (error) { alert('Failed: ' + error.message); return; }
    setLeads((prev) => prev.filter((l) => l.id !== id));
  };

  const permanentDelete = async (id: string) => {
    if (!confirm('Permanently delete? Cannot be undone.')) return;
    const { error } = await supabase.from('leads').delete().eq('id', id);
    if (error) { alert('Failed: ' + error.message); return; }
    setLeads((prev) => prev.filter((l) => l.id !== id));
  };

  if (loading) return <div className="flex items-center justify-center min-h-[300px]"><Spinner size="md" /></div>;

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Deleted Leads</h1>
          <p className="text-sm text-muted mt-1">Archived leads. Restore or permanently delete.</p>
        </div>
        <Link href="/dashboard" className="text-sm text-accent hover:underline">Back to Leads</Link>
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

      {leads.length === 0 ? (
        <div className="text-center py-12"><Users className="w-8 h-8 text-muted mx-auto mb-3" /><p className="text-muted">No deleted leads</p></div>
      ) : (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-muted px-1">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-primary" />
            Select all
          </label>
          {leads.map((lead) => (
            <div key={lead.id} className="bg-secondary border border-border rounded-xl p-4 flex items-center gap-4">
              <input type="checkbox" checked={selected.has(lead.id)} onChange={() => toggle(lead.id)} className="accent-primary shrink-0" />
              <h3 className="font-semibold text-foreground text-base truncate flex-1">{lead.title || 'Untitled Lead'}</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => restore(lead.id)} className="text-muted hover:text-green-400 transition p-1" title="Restore"><RotateCcw className="w-4 h-4" /></button>
                <button onClick={() => permanentDelete(lead.id)} className="text-muted hover:text-red-400 transition p-1" title="Permanent delete"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
