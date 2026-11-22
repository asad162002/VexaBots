/**
 * Follow-up dates, read the same way everywhere.
 *
 * The comparison is by calendar day rather than by the clock. A follow-up is stored as midday on
 * the date the caller picked, so comparing timestamps would make a follow-up set for today at
 * 14:00 read as overdue at 14:01. The caller picked a day, so a day is what is compared and shown.
 *
 * Used by My Queue (the due strip, the working order, the badge on the lead card) and by the
 * follow-ups board, so the two screens cannot disagree about which day it is.
 */

export type FollowUpState = 'overdue' | 'today' | 'upcoming' | 'none';

/** Midnight local time for a date or timestamp, as a number so two days compare with `===`. */
export function startOfDay(value: Date | string): number {
  const d = typeof value === 'string' ? new Date(value) : new Date(value.getTime());
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function followUpState(value: string | null | undefined): FollowUpState {
  if (!value) return 'none';
  const due = startOfDay(value);
  const today = startOfDay(new Date());
  if (due < today) return 'overdue';
  if (due === today) return 'today';
  return 'upcoming';
}

/** Working order: what is overdue first, then what is due today, then everything else. */
export function followUpRank(value: string | null | undefined): number {
  const state = followUpState(value);
  if (state === 'overdue') return 0;
  if (state === 'today') return 1;
  return 2;
}

/** What the caller reads on the row: the state in words, then the date. */
export function followUpLabel(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value).toLocaleDateString();
  const state = followUpState(value);
  if (state === 'overdue') return `Overdue since ${date}`;
  if (state === 'today') return `Due today, ${date}`;
  return `Due ${date}`;
}

/** Soonest first, which is the order both screens list follow-ups in. */
export function byFollowUpDate(a: string | null, b: string | null): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return new Date(a).getTime() - new Date(b).getTime();
}
