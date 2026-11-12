import type { LeadStatus } from '@/lib/types';

export interface OutcomeOption {
  key: number;
  label: string;
  status: LeadStatus;
  requiresFollowUp: boolean;
  shortcut: string;
}

export const OUTCOMES: OutcomeOption[] = [
  { key: 1, label: 'No answer', status: 'contacted', requiresFollowUp: false, shortcut: '1' },
  { key: 2, label: 'Voicemail', status: 'contacted', requiresFollowUp: false, shortcut: '2' },
  { key: 3, label: 'Not interested', status: 'not_interested', requiresFollowUp: false, shortcut: '3' },
  { key: 4, label: 'Call back', status: 'contacted', requiresFollowUp: true, shortcut: '4' },
  { key: 5, label: 'Interested', status: 'interested', requiresFollowUp: false, shortcut: '5' },
  { key: 6, label: 'Booked meeting', status: 'meeting_booked', requiresFollowUp: false, shortcut: '6' },
  { key: 7, label: 'Wrong number', status: 'dead', requiresFollowUp: false, shortcut: '7' },
];
