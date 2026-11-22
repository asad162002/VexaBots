'use client';

/**
 * `/dashboard/follow-ups`: every follow-up date that is set, on both lead tables.
 *
 * One screen for both roles, scoped by the same rule the queue uses: a caller sees the follow-ups
 * they own, an admin sees every caller's, named, with a filter per caller. That is what makes
 * "who has to call whom, and when" answerable without opening leads one at a time.
 *
 * Read straight from the database rather than from the activity log, because the lead is what
 * carries the date. An activity row records that a follow-up was set at the time; the lead row
 * says whether it is still owed.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { byFollowUpDate, followUpLabel, followUpState } from '@/lib/follow-ups';

type FollowUpRow = {
  key: string;
  id: string;
  leadTable: 'leads' | 'linkedin_leads';
  name: string;
  role: string | null;
  phone: string | null;
  assignedTo: string | null;
  dueAt: string;
  notes: string | null;
};

const STATE_BADGE: Record<string, string> = {
  overdue: 'bg-red-500/10 text-red-400 border-red-500/30',
  today: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  upcoming: 'bg-[#191a1b] text-muted border-[rgba(255,255,255,0.06)]',
};

export default function FollowUpsPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<FollowUpRow[]>([]);
  const [callers, setCallers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<'all' | 'overdue' | 'today' | 'upcoming'>('all');
  const [callerFilter, setCallerFilter] = useState<string>('all');

  const load = useCallback(async () => {
    if (!user) return;
    try {
      /*
       * The read comes first and every state update happens after it, so nothing is set
       * synchronously from the effect body. `loading` starts true, so a first render shows the
       * spinner without an effect having to set it.
       */
      const [leadsRes, liRes] = await Promise.all([
        supabase
          .from('leads')
          .select('id, title, phone, assigned_to, next_follow_up_at, notes, deleted_at')
          .not('next_follow_up_at', 'is', null),
        supabase
          .from('linkedin_leads')
          .select('id, lead_name, title, phone, assigned_to, next_follow_up_at, notes, deleted_at')
          .not('next_follow_up_at', 'is', null),
      ]);
      if (leadsRes.error) throw leadsRes.error;
      if (liRes.error) throw liRes.error;

      const fromLeads: FollowUpRow[] = (leadsRes.data ?? [])
        .filter((l) => !l.deleted_at)
        .map((l) => ({
          key: `leads:${l.id}`,
          id: l.id as string,
          leadTable: 'leads' as const,
          name: (l.title as string) || 'Untitled',
          role: null,
          phone: (l.phone as string) || null,
          assignedTo: (l.assigned_to as string) || null,
          dueAt: l.next_follow_up_at as string,
          notes: (l.notes as string) || null,
        }));

      const fromLinkedIn: FollowUpRow[] = (liRes.data ?? [])
        .filter((l) => !l.deleted_at)
        .map((l) => ({
          key: `linkedin_leads:${l.id}`,
          id: l.id as string,
          leadTable: 'linkedin_leads' as const,
          name: (l.lead_name as string) || 'Untitled',
          // On a LinkedIn contact the row's own title is the person's role, not the company.
          role: (l.title as string) || null,
          phone: (l.phone as string) || null,
          assignedTo: (l.assigned_to as string) || null,
          dueAt: l.next_follow_up_at as string,
          notes: (l.notes as string) || null,
        }));

      const all = [...fromLeads, ...fromLinkedIn].sort((a, b) =>
        byFollowUpDate(a.dueAt, b.dueAt)
      );

      /*
       * The role guard, carried whole. A member sees only their own follow-ups; an admin sees the
       * team's. Moving the filter into JS is what dropped the admin half of this rule once before,
       * so it is written as one expression rather than as the assignment clause alone.
       */
      setRows(isAdmin ? all : all.filter((r) => r.assignedTo === user.id));

      if (isAdmin) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name, email');
        const map: Record<string, string> = {};
        for (const p of profiles ?? []) {
          const id = p.id as string;
          map[id] = (p.full_name as string) || (p.email as string) || 'Unknown';
        }
        setCallers(map);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load follow-ups.');
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin]);

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [authLoading, load]);

  const counts = useMemo(() => {
    let overdue = 0;
    let today = 0;
    let upcoming = 0;
    for (const r of rows) {
      const s = followUpState(r.dueAt);
      if (s === 'overdue') overdue += 1;
      else if (s === 'today') today += 1;
      else upcoming += 1;
    }
    return { overdue, today, upcoming };
  }, [rows]);

  const callerOptions = useMemo(() => {
    const ids = Array.from(
      new Set(rows.map((r) => r.assignedTo).filter((v): v is string => Boolean(v)))
    );
    return ids
      .map((id) => ({ id, name: callers[id] || 'Unknown caller' }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, callers]);

  const hasUnassigned = useMemo(() => rows.some((r) => !r.assignedTo), [rows]);

  const visible = useMemo(() => {
    return rows.filter((r) => {
      if (stateFilter !== 'all' && followUpState(r.dueAt) !== stateFilter) return false;
      if (isAdmin && callerFilter !== 'all') {
        if (callerFilter === 'unassigned') return !r.assignedTo;
        return r.assignedTo === callerFilter;
      }
      return true;
    });
  }, [rows, stateFilter, callerFilter, isAdmin]);

  /** An admin opens the lead's own page; a caller works it from the queue. */
  const leadHref = (row: FollowUpRow): string => {
    if (!isAdmin) return '/dashboard/my-queue';
    return row.leadTable === 'linkedin_leads'
      ? `/dashboard/linkedin-leads/${row.id}`
      : `/dashboard/leads/${row.id}`;
  };

  if (authLoading || (loading && rows.length === 0)) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">Follow-ups</h1>
            {isAdmin && (
              <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded-full">
                Every caller
              </span>
            )}
          </div>
          <p className="text-sm text-muted mt-1.5">
            {isAdmin
              ? 'Every follow-up date set across the team, soonest first. Each caller sees their own here too.'
              : 'The follow-up dates on the leads assigned to you, soonest first.'}
          </p>
        </div>
        <Link href="/dashboard/my-queue" className="text-xs text-accent hover:underline shrink-0">
          Back to My Queue
        </Link>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-500/30 rounded-xl text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/30">
          <CalendarClock className="w-3 h-3" />
          {counts.overdue} overdue
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/30">
          <CalendarClock className="w-3 h-3" />
          {counts.today} due today
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-[#191a1b] text-muted border border-[rgba(255,255,255,0.06)]">
          <CalendarClock className="w-3 h-3" />
          {counts.upcoming} upcoming
        </span>

        <div className="flex-1" />

        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value as typeof stateFilter)}
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary [&>option]:bg-secondary [&>option]:text-foreground"
        >
          <option value="all">Any date</option>
          <option value="overdue">Overdue</option>
          <option value="today">Due today</option>
          <option value="upcoming">Upcoming</option>
        </select>

        {isAdmin && (
          <select
            value={callerFilter}
            onChange={(e) => setCallerFilter(e.target.value)}
            className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary [&>option]:bg-secondary [&>option]:text-foreground"
          >
            <option value="all">Every caller</option>
            {callerOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            {hasUnassigned && <option value="unassigned">Unassigned</option>}
          </select>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="bg-[#0f1011] border border-[rgba(255,255,255,0.06)] rounded-xl p-6">
          <p className="text-sm text-muted">
            {rows.length === 0
              ? 'No follow-up dates are set. A caller sets one after a call: pick "Call back", or type any date before saving.'
              : 'Nothing matches those filters.'}
          </p>
        </div>
      ) : (
        <div className="bg-[#0f1011] border border-[rgba(255,255,255,0.06)] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Lead</th>
                {isAdmin && <th className="px-4 py-3 font-medium">Caller</th>}
                <th className="px-4 py-3 font-medium">Follow-up</th>
                <th className="px-4 py-3 font-medium">Notes</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const state = followUpState(row.dueAt);
                return (
                  <tr key={row.key} className="border-t border-[rgba(255,255,255,0.06)]">
                    <td className="px-4 py-3">
                      <div className="text-foreground font-medium truncate max-w-[220px]">{row.name}</div>
                      <div className="text-[11px] text-muted truncate max-w-[220px]">
                        {row.role ? `${row.role} · ` : ''}
                        {row.phone || 'no phone'}
                        {' · '}
                        {row.leadTable === 'linkedin_leads' ? 'LinkedIn' : 'Google Maps'}
                      </div>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-muted">
                        {row.assignedTo ? callers[row.assignedTo] || 'Unknown caller' : 'Unassigned'}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border ${STATE_BADGE[state]}`}
                      >
                        <CalendarClock className="w-3 h-3" />
                        {followUpLabel(row.dueAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted text-xs truncate max-w-[260px]">
                      {row.notes || ''}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={leadHref(row)}
                        className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                      >
                        Open
                        <ExternalLink className="w-3 h-3" />
                      </Link>
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
}
