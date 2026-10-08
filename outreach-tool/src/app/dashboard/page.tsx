'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { STATUS_LABELS, STATUS_COLORS, type Lead, type LeadStatus, type LeadSource } from '@/lib/types';
import Link from 'next/link';

const STATUS_OPTIONS: { value: LeadStatus | 'all'; label: string; color: string }[] = [
  { value: 'all', label: 'All', color: 'text-gray-400' },
  { value: 'new', label: 'New', color: 'text-gray-300' },
  { value: 'contacted', label: 'Contacted', color: 'text-blue-400' },
  { value: 'interested', label: 'Interested', color: 'text-green-400' },
  { value: 'not_interested', label: 'Not Interested', color: 'text-red-400' },
  { value: 'send_info', label: 'Send Info', color: 'text-yellow-400' },
  { value: 'meeting_booked', label: 'Meeting', color: 'text-purple-400' },
  { value: 'dead', label: 'Dead', color: 'text-gray-500' },
];

const SOURCE_OPTIONS: { value: LeadSource | 'all'; label: string }[] = [
  { value: 'all', label: 'All Sources' },
  { value: 'google_maps', label: 'Google Maps' },
  { value: 'manual', label: 'Manual' },
  { value: 'csv_import', label: 'CSV Import' },
  { value: 'apify_n8n', label: 'Apify/n8n' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'other', label: 'Other' },
];

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<LeadSource | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'icp_high' | 'follow_up'>('newest');

  useEffect(() => {
    fetchLeads();
  }, [statusFilter, sourceFilter, searchQuery, sortBy]);

  const fetchLeads = async () => {
    setLoading(true);

    let query = supabase
      .from('leads')
      .select('*')
      .order(sortBy === 'icp_high' ? 'icp_score' : sortBy === 'follow_up' ? 'next_follow_up_at' : 'created_at', {
        ascending: sortBy === 'follow_up',
      });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    if (sourceFilter !== 'all') {
      query = query.eq('source', sourceFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      query = query.or(`title.ilike.%${q},owner_name.ilike.%${q},phone.ilike.%${q},city.ilike.%${q},website.ilike.%${q}`);
    }

    const { data, error } = await query.limit(100);

    if (error) {
      console.error('Error fetching leads:', error);
    }

    setLeads(data ?? []);
    setLoading(false);
  };

  const filteredLeads = leads.filter((lead) => {
    if (statusFilter !== 'all' && lead.status !== statusFilter) return false;
    if (sourceFilter !== 'all' && lead.source !== sourceFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const match =
        lead.title?.toLowerCase().includes(q) ||
        lead.owner_name?.toLowerCase().includes(q) ||
        lead.phone?.includes(q) ||
        lead.city?.toLowerCase().includes(q) ||
        lead.website?.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const sortedLeads = [...filteredLeads].sort((a, b) => {
    if (sortBy === 'icp_high') {
      return (b.icp_score ?? 0) - (a.icp_score ?? 0);
    }
    if (sortBy === 'follow_up') {
      const aDate = a.next_follow_up_at ? new Date(a.next_follow_up_at).getTime() : Infinity;
      const bDate = b.next_follow_up_at ? new Date(b.next_follow_up_at).getTime() : Infinity;
      return aDate - bDate;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Leads</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {leads.length} total lead{leads.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={fetchLeads}
          className="bg-[#3f3f46] hover:bg-[#52525b] text-white text-sm font-medium rounded-lg px-4 py-2 transition flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-4 mb-5">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Search</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, company, phone..."
              className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as LeadStatus | 'all')}
              className="w-full sm:w-[130px] bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[#1a1a1a]">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Source */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Source</label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as LeadSource | 'all')}
              className="w-full sm:w-[130px] bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            >
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[#1a1a1a]">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Sort</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="w-full sm:w-[130px] bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            >
              <option value="newest" className="bg-[#1a1a1a]">Newest First</option>
              <option value="icp_high" className="bg-[#1a1a1a]">ICP Score (High)</option>
              <option value="follow_up" className="bg-[#1a1a1a]">Follow-up Due</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lead list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-gray-500 text-sm">Loading leads...</div>
        </div>
      ) : sortedLeads.length === 0 ? (
        <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-12">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-[#27272a] flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-gray-300 font-medium mb-1">No leads found</p>
            <p className="text-gray-500 text-sm">
              Try adjusting your filters or search query.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedLeads.map((lead) => (
            <Link
              key={lead.id}
              href={`/dashboard/leads/${lead.id}`}
              className="block bg-[#1a1a1a] border border-[#27272a] rounded-xl p-4 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/5 transition cursor-pointer group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                    <h3 className="font-semibold text-white text-base truncate">
                      {lead.title || 'Untitled Business'}
                    </h3>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[lead.status]} border ${STATUS_COLORS[lead.status].replace('text-', 'border-').replace('-400', '-500').replace('-500', '-400')}`}>
                      {STATUS_LABELS[lead.status]}
                    </span>
                    {lead.icp_score !== null && (
                      <span className="text-xs text-gray-400 font-semibold bg-[#27272a] px-2 py-0.5 rounded">
                        ICP {lead.icp_score}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    {lead.owner_name && (
                      <span className="text-gray-400">
                        Owner: <span className="text-gray-200 font-medium">{lead.owner_name}</span>
                      </span>
                    )}
                    {lead.phone && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          window.location.href = `tel:${lead.phone}`
                        }}
                        className="text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 text-left"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        {lead.phone}
                      </button>
                    )}
                    {lead.city && (
                      <span className="text-gray-500">{lead.city}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    {lead.source && (
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500/50" />
                        {lead.source.replace('_', ' ')}
                      </span>
                    )}
                    {lead.created_at && (
                      <span>Added {new Date(lead.created_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
