import { type Profile } from '@/lib/types';
import { Phone, MessageSquare, Mail, FileText, Calendar, Clock, ChevronDown, ChevronRight } from 'lucide-react';

export interface Activity {
  id: string;
  lead_id: string;
  profile_id: string;
  activity_type: 'call' | 'text' | 'email' | 'note' | 'meeting' | 'other';
  content: string;
  outcome: string | null;
  created_at: string;
  next_follow_up_at: string | null;
}

export interface ActivityGroup {
  profileId: string;
  profileName: string;
  profileEmail: string | null;
  count: number;
  activities: Activity[];
}

export interface LeadInfo {
  id: string;
  title: string | null;
  status: string;
}

export { Profile };

export const ACTIVITY_ICONS: Record<string, any> = {
  call: Phone,
  text: MessageSquare,
  email: Mail,
  note: FileText,
  meeting: Calendar,
  other: Clock,
};

export const ACTIVITY_COLORS: Record<string, string> = {
  call: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  text: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  email: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  note: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  meeting: 'bg-green-500/20 text-green-400 border-green-500/30',
  other: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
};

export const DATE_FILTERS = [
  { value: '24h', label: '24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: 'all', label: 'All Time' },
];

export const STATUS_COLORS: Record<string, string> = {
  new: 'bg-gray-200 text-gray-700',
  contacted: 'bg-blue-100 text-blue-700',
  interested: 'bg-green-100 text-green-700',
  not_interested: 'bg-red-100 text-red-700',
  send_info: 'bg-yellow-100 text-yellow-700',
  meeting_booked: 'bg-purple-100 text-purple-700',
};

export const formatDate = (dateStr: string): string => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString();
};

export const getTimeAgo = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  const diffMins = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  if (diffMins > 0) return `${diffMins}m ago`;
  return 'just now';
};

export { ChevronDown, ChevronRight };
