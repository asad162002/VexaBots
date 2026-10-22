import { type Lead, type LeadStatus } from '@/lib/types';

export type { Lead, LeadStatus };

export interface ActivityEntry {
  id: string;
  action: string;
  description: string;
  timestamp: string;
}

export interface ConversionFunnel {
  total: number;
  new: number;
  contacted: number;
  interested: number;
  send_info: number;
  meeting_booked: number;
  dead: number;
  not_interested: number;
}

export interface MemberStats {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  leads_assigned: number;
  leads_by_status: Record<LeadStatus, number>;
  total_leads: number;
  funnel: ConversionFunnel;
}

export interface StatusDistribution {
  status: LeadStatus;
  count: number;
  percentage: number;
}

export interface SourceDistribution {
  source: string;
  count: number;
  percentage: number;
}

export interface LeadWithDetails {
  id: string;
  title: string;
  status: LeadStatus;
  source: string | null;
  category_name: string | null;
  assigned_to: string | null;
  assigned_at: string | null;
  assigned_by: string | null;
  updated_at: string | null;
}

export const STATUS_LABELS_DISPLAY: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  interested: 'Interested',
  not_interested: 'Not Interested',
  send_info: 'Send Info',
  meeting_booked: 'Meeting Booked',
  dead: 'Dead',
};

export const STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-gray-400',
  contacted: 'bg-blue-400',
  interested: 'bg-green-400',
  not_interested: 'bg-red-400',
  send_info: 'bg-yellow-400',
  meeting_booked: 'bg-purple-400',
  dead: 'bg-gray-600',
};

export const SOURCE_LABELS: Record<string, string> = {
  google_maps: 'Google Maps',
  manual: 'Manual',
  csv_import: 'CSV Import',
  apify_n8n: 'Apify/n8n',
  linkedin: 'LinkedIn',
  other: 'Other',
};

export const FUNNEL_STEPS = [
  { key: 'total', label: 'Total Leads' },
  { key: 'new', label: 'New', color: 'text-gray-400' },
  { key: 'contacted', label: 'Contacted', color: 'text-blue-400' },
  { key: 'interested', label: 'Interested', color: 'text-green-400' },
  { key: 'send_info', label: 'Send Info', color: 'text-yellow-400' },
  { key: 'meeting_booked', label: 'Meeting Booked', color: 'text-purple-400' },
  { key: 'not_interested', label: 'Not Interested', color: 'text-red-400' },
  { key: 'dead', label: 'Dead', color: 'text-gray-600' },
];

export const EMPTY_STATUS: Record<LeadStatus, number> = {
  new: 0, contacted: 0, interested: 0, not_interested: 0,
  send_info: 0, meeting_booked: 0, dead: 0
};

export const computeFunnel = (leads: LeadWithDetails[]): ConversionFunnel => {
  const funnel: ConversionFunnel = {
    total: leads.length, new: 0, contacted: 0, interested: 0,
    send_info: 0, meeting_booked: 0, dead: 0, not_interested: 0,
  };
  leads.forEach((lead) => {
    const status = lead.status as LeadStatus;
    if (status in funnel) {
      funnel[status] = (funnel[status] as number) + 1;
    }
  });
  return funnel;
};
