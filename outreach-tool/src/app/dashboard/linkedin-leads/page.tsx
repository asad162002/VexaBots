'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Filter, Users, Mail, ExternalLink, Copy } from 'lucide-react';

interface LinkedInLead {
  id: string;
  place_id: string;
  lead_name: string | null;
  title: string | null;
  email: string | null;
  email_status: string | null;
  linkedin_url: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}

const SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Sources' },
  { value: 'linkedin_owner_search', label: 'LinkedIn Owner Search' },
  { value: 'apollo_enrichment', label: 'Apollo Enrichment' },
];

const PAGE_SIZE = 50;

export default function LinkedinLeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<LinkedInLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [emailFilter, setEmailFilter] = useState<'all' | 'verified' | 'not_found'>('all');
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const observer = useRef<IntersectionObserver | null>(null);
  const lastLeadRef = useRef<HTMLDivElement | null>(null);

  const buildQuery = () => {
    let query = supabase
      .from('linkedin_leads')
      .select(`*`, { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (sourceFilter !== 'all') {
      query = query.eq('source', sourceFilter);
    }

    if (emailFilter === 'verified') {
      query = query.not('email', 'is', null).neq('email', '');
    } else if (emailFilter === 'not_found') {
      query = query.or('email.is.null,email.eq.');
    }

    return query;
  };

  const fetchLeads = useCallback(async (offset = 0) => {
    if (offset === 0) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    let query = buildQuery();

    // Apply search client-side (already filtered server-side for source/email)
    const { data, error, count } = await query.range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error('Error fetching linkedin leads:', error);
    } else {
      if (offset === 0) {
        setLeads(data ?? []);
      } else {
        setLeads((prev) => [...prev, ...(data ?? [])]);
      }
      setHasMore(data ? data.length === PAGE_SIZE : false);
    }

    setLoading(false);
    setLoadingMore(false);
  }, [sourceFilter, emailFilter]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    fetchLeads(leads.length);
  }, [loadingMore, hasMore, leads.length, fetchLeads]);

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    if (observer.current) {
      observer.current.disconnect();
    }

    observer.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        loadMore();
      }
    }, { root: null, rootMargin: '100px', threshold: 0 });

    if (lastLeadRef.current) {
      observer.current.observe(lastLeadRef.current);
    }

    return () => {
      if (observer.current) {
        observer.current.disconnect();
      }
    };
  }, [loadMore]);

  useEffect(() => {
    // Reset and re-fetch when filters change
    setLeads([]);
    setHasMore(true);
    fetchLeads(0);
  }, [sourceFilter, emailFilter]);

  // Filter leads client-side for search
  const filteredLeads = leads.filter((lead) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        lead.lead_name?.toLowerCase().includes(q) ||
        lead.email?.toLowerCase().includes(q) ||
        lead.title?.toLowerCase().includes(q) ||
        lead.linkedin_url?.toLowerCase().includes(q) ||
        lead.source?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const copyToClipboard = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const EmailIcon = ({ status }: { status: string | null }) => {
    if (status === 'verified') {
      return <Mail className="w-4 h-4 text-green-400" />;
    }
    return <Mail className="w-4 h-4 text-gray-500" />;
  };

  if (loading && leads.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-gray-400">Loading LinkedIn leads...</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">LinkedIn Leads</h1>
        <p className="text-sm text-gray-400 mt-1">
          Enriched contacts with LinkedIn profiles, emails, and titles for your outreach.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search leads..."
              className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            />
          </div>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
          >
            {SOURCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#1a1a1a]">
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={emailFilter}
            onChange={(e) => setEmailFilter(e.target.value as typeof emailFilter)}
            className="bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
          >
            <option value="all" className="bg-[#1a1a1a]">All Emails</option>
            <option value="verified" className="bg-[#1a1a1a]">Has Email</option>
            <option value="not_found" className="bg-[#1a1a1a]">No Email</option>
          </select>
        </div>
      </div>

      {/* Results summary */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-400">
          {filteredLeads.length} leads found
        </p>
      </div>

      {/* Leads list */}
      {filteredLeads.length === 0 && !loading ? (
        <div className="text-center py-12">
          <Users className="w-8 h-8 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No leads found</p>
          <p className="text-xs text-gray-600 mt-1">
            Upload a JSON file with enrichment data to populate this page.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredLeads.map((lead, index) => {
            const isLast = index === filteredLeads.length - 1;
            const showObserver = isLast && filteredLeads.length > 0;

            return (
              <div
                key={lead.id}
                ref={showObserver ? lastLeadRef : null}
                className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-4 hover:border-blue-500/50 hover:shadow-lg transition group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                      <h3 className="font-semibold text-white text-base truncate">
                        <Link href={`/dashboard/linkedin-leads/${lead.id}`}>
                          {lead.lead_name || 'Untitled Contact'}
                        </Link>
                      </h3>
                      {lead.source && (
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                          lead.source === 'apollo_enrichment'
                            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                            : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        }`}>
                          {lead.source === 'apollo_enrichment' ? 'Apollo' : 'LinkedIn'}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm mb-2">
                      {lead.title && (
                        <span className="text-gray-400">
                          {lead.title}
                        </span>
                      )}
                      {lead.email && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(lead.email!)}
                          className="text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 group/inline"
                        >
                          {lead.email}
                          {copiedEmail === lead.email && (
                            <svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      )}
                      {!lead.email && (
                        <span className="text-gray-500 italic">No email</span>
                      )}
                    </div>

                    {lead.linkedin_url && (
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <ExternalLink className="w-3 h-3" />
                        <a
                          href={lead.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-blue-400 truncate"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {lead.linkedin_url.replace('https://www.', '').replace('https://', '')}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Loading more indicator */}
      {loadingMore && (
        <div className="text-center py-6 text-gray-400">
          Loading more leads...
        </div>
      )}
    </div>
  );
}