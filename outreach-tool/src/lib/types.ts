export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'member';
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Lead = {
  id: string;
  owner_id: string | null;
  title: string | null;
  category_name: string | null;
  categories: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country_code: string | null;
  website: string | null;
  total_score: number | null;
  reviews_count: number | null;
  place_id: string | null;
  rank: string | null;
  is_advertisement: boolean | null;
  search_string: string | null;
  url: string | null;
  opening_hours: string | null;
  is_24_hours: boolean | null;
  permanently_closed: boolean | null;
  temporarily_closed: boolean | null;
  domain: string | null;
  owner_name: string | null;
  owner_role: string | null;
  owner_linkedin_url: string | null;
  owner_snippet: string | null;
  owner_found: boolean | null;
  apollo_phone: string | null;
  apollo_linkedin: string | null;
  apollo_employees: string | null;
  apollo_revenue: string | null;
  apollo_founded: string | null;
  apollo_description: string | null;
  apollo_tech_stack: string | null;
  apollo_keywords: string | null;
  running_google_ads: boolean | null;
  running_fb_ads: boolean | null;
  revenue_proxy: string | null;
  ad_running: boolean | null;
  no_chatbot: boolean | null;
  no_crm: boolean | null;
  no_booking_system: boolean | null;
  multi_channel_inbound: boolean | null;
  company_size_estimate: 'solo' | 'small' | 'medium' | 'large' | null;
  icp_score: number | null;
  icp_breakdown: Record<string, unknown> | null;
  status: LeadStatus;
  source: LeadSource;
  notes: string | null;
  source_details: Record<string, unknown> | null;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'interested'
  | 'not_interested'
  | 'send_info'
  | 'meeting_booked'
  | 'dead';

export type LeadSource =
  | 'google_maps'
  | 'manual'
  | 'csv_import'
  | 'apify_n8n'
  | 'linkedin'
  | 'other';

export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  interested: 'Interested',
  not_interested: 'Not Interested',
  send_info: 'Send Info',
  meeting_booked: 'Meeting Booked',
  dead: 'Dead',
};

export const STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-gray-100 text-gray-700',
  contacted: 'bg-blue-100 text-blue-700',
  interested: 'bg-green-100 text-green-700',
  not_interested: 'bg-red-100 text-red-700',
  send_info: 'bg-yellow-100 text-yellow-700',
  meeting_booked: 'bg-purple-100 text-purple-700',
  dead: 'bg-gray-200 text-gray-500',
};
