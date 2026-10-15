'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Filter, Users, Mail, ExternalLink, Copy, Shield, CheckSquare, Square, UserPlus } from 'lucide-react';
import Spinner from '@/components/ui/spinner';
import { useAuth } from '@/lib/auth-context';

interface LinkedInLead {
  id: string;
  place_id: string;
  lead_name: string | null;
  title: string | null;
  email: string | null;
  email_status: string | null;
  linkedin_url: string | null;
  source: string | null;
  notes: string | null;
  assigned_to: string | null;
  assigned_at: string | null;
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
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingRole, setLoadingRole] = useState(true);
  const [leads, setLeads] = useState<LinkedInLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [emailFilter, setEmailFilter] = useState<'all' | 'verified' | 'not_found'>('all');
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [selectN, setSelectN] = useState(50);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [assignmentTarget, setAssignmentTarget] = useState('');
  const [assigning, setAssigning] = useState(false);

  const observer = useRef<IntersectionObserver | null>(null);
  const lastLeadRef = useRef<HTMLDivElement | null>(null);
  const initialFetchDone = useRef(false);

  useEffect(() => {
    const checkRole = async () => {
      if (!user?.id) {
        setLoadingRole(false);
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      setIsAdmin(profile?.role === 'admin');
      setLoadingRole(false);
    };
    const loadProfiles = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name');
      if (!error) setProfiles(data ?? []);
    };
    checkRole();
    loadProfiles();
  }, [user]);

  const fetchLeads = useCallback(async (offset = 0) => {
    if (offset === 0) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      let placeIds: string[] = [];
      let directAssignedIds: string[] = [];

      // For members, get leads assigned to them
      if (user && user.id && !isAdmin) {
        // Get place_ids from leads table (for Google Maps leads)
        const { data: assignedLeads, error: assignError } = await supabase
          .from('leads')
          .select('place_id')
          .eq('assigned_to', user.id)
          .not('place_id', 'is', null)
          .neq('place_id', '');

        if (assignError) {
          console.error('Error fetching assigned place_ids:', assignError);
        } else {
          placeIds = (assignedLeads || []).map(l => l.place_id).filter(Boolean) as string[];
        }

        // Get LinkedIn lead IDs directly assigned to this member
        const { data: directAssignedLL, error: llError } = await supabase
          .from('linkedin_leads')
          .select('id')
          .eq('assigned_to', user.id);
        
        if (llError) {
          console.error('Error fetching directly assigned LinkedIn leads:', llError);
        } else {
          directAssignedIds = (directAssignedLL || []).map((l: any) => l.id);
        }
      }

      // If member has no assigned leads (neither via place_id nor direct), return empty
      if (!isAdmin && user?.id && placeIds.length === 0 && directAssignedIds.length === 0) {
        setLeads([]);
        setHasMore(false);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      let query = supabase
        .from('linkedin_leads')
        .select('*, assigned_to, assigned_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      // Members only see LinkedIn leads where place_id matches OR directly assigned
      if (!isAdmin && directAssignedIds.length > 0 && placeIds.length > 0) {
        query = query.or(`place_id.in.((${placeIds.join(',')})),id.in.((${directAssignedIds.join(',')}))`);
      } else if (!isAdmin && placeIds.length > 0) {
        query = query.in('place_id', placeIds);
      } else if (!isAdmin && directAssignedIds.length > 0) {
        query = query.in('id', directAssignedIds);
      }

      if (sourceFilter !== 'all') {
        query = query.eq('source', sourceFilter);
      }

      if (emailFilter === 'verified') {
        query = query.not('email', 'is', null).neq('email', '');
      } else if (emailFilter === 'not_found') {
        query = query.or('email.is.null,email.eq.');
      }

      if (assignmentFilter === 'assigned') {
        query = query.not('assigned_to', 'is', null);
      } else if (assignmentFilter === 'unassigned') {
        query = query.is('assigned_to', null);
      }

      const { data, error, count } = await query;

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
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [sourceFilter, emailFilter, assignmentFilter, isAdmin, user, profilesLoaded, dateFilter]);

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
    // Don't fetch until we know the user's role
    if (loadingRole) return;
    // Initial fetch and refetch when filters change
    if (initialFetchDone.current) {
      // Only refetch when filters change, not on every re-render
      setLeads([]);
      setHasMore(true);
      setSelectedLeads(new Set());
      fetchLeads(0);
    } else {
      initialFetchDone.current = true;
      fetchLeads(0);
    }
  }, [sourceFilter, emailFilter, isAdmin, user, loadingRole]);

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

  const handleAssignSelected = async () => {
    if (!selectedLeads.size || !assignmentTarget) return;
    setAssigning(true);
    const ids = Array.from(selectedLeads);
    
    // Get previous assignees before updating
    const { data: prevLeads } = await supabase
      .from('linkedin_leads')
      .select('id, assigned_to')
      .in('id', ids);
    
    const { error } = await supabase
      .from('linkedin_leads')
      .update({
        assigned_to: assignmentTarget || null,
        assigned_at: assignmentTarget ? new Date().toISOString() : null,
      })
      .in('id', ids);
    if (error) {
      console.error('Error assigning leads:', error);
    } else {
      // Log to assignment_history for each lead whose assignment changed
      const historyEntries = (prevLeads || []).map((pl) => ({
        lead_id: pl.id,
        assigned_to: assignmentTarget || null,
        assigned_by: user?.id || null,
        assigned_at: new Date().toISOString(),
        previous_assignee: pl.assigned_to || null,
        notes: null,
      }));
      await supabase.from('assignment_history').insert(historyEntries);
      
      setLeads((prev) => prev.map(l =>
        selectedLeads.has(l.id)
          ? { ...l, assigned_to: assignmentTarget, assigned_at: assignmentTarget ? new Date().toISOString() : null }
          : l
      ));
      setSelectedLeads(new Set());
      setAssignmentTarget('');
    }
    setAssigning(false);
  };

  const selectFirstN = (n: number) => {
    const toSelect = filteredLeads.slice(0, n).map(l => l.id);
    setSelectedLeads(new Set(toSelect));
  };

  const EmailIcon = ({ status }: { status: string | null }) => {
    if (status === 'verified') {
      return <Mail className="w-4 h-4 text-green-400" />;
    }
    return <Mail className="w-4 h-4 text-gray-500" />;
  };

  if (loadingRole || (loading && leads.length === 0)) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="flex items-center gap-3 text-gray-400">
          <Spinner size="md" />
          <span>Loading LinkedIn leads...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">LinkedIn Leads</h1>
          <p className="text-sm text-gray-400 mt-1">
            Enriched contacts with LinkedIn profiles, emails, and titles for your outreach.
          </p>
        </div>
        {!isAdmin && (
          <span className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-1.5">
            Member View
          </span>
        )}
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

          <select
            value={assignmentFilter}
            onChange={(e) => setAssignmentFilter(e.target.value as typeof assignmentFilter)}
            className="bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
          >
            <option value="all" className="bg-[#1a1a1a]">All Leads</option>
            <option value="assigned" className="bg-[#1a1a1a]">Assigned</option>
            <option value="unassigned" className="bg-[#1a1a1a]">Unassigned</option>
          </select>
        </div>
      </div>

      {/* Results summary + bulk action */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <p className="text-sm text-gray-400">
            {filteredLeads.length} leads found
          </p>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max={filteredLeads.length}
                value={selectN}
                onChange={(e) => setSelectN(Math.min(parseInt(e.target.value) || 0, filteredLeads.length))}
                className="w-16 bg-[#27272a] border border-[#3f3f46] rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="N"
              />
              <button
                onClick={() => selectFirstN(selectN)}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium"
              >
                Select First N
              </button>
            </div>
          )}
        </div>
        {/* Bulk action bar for admins */}
        {isAdmin && selectedLeads.size > 0 && (
          <div className="flex items-center gap-3 bg-[#27272a]/50 border border-[#3f3f46] rounded-lg px-4 py-2">
            <span className="text-sm text-gray-300">{selectedLeads.size} selected</span>
            <select
              value={assignmentTarget}
              onChange={(e) => setAssignmentTarget(e.target.value)}
              className="bg-[#27272a] border border-[#3f3f46] rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Assign to...</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name || p.email || 'Unnamed'}
                </option>
              ))}
            </select>
            <button
              onClick={handleAssignSelected}
              disabled={assigning || !assignmentTarget}
              className="inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold rounded-lg px-3 py-1.5 text-sm transition disabled:cursor-not-allowed"
            >
              <UserPlus className="w-3.5 h-3.5" />
              {assigning ? 'Assigning...' : 'Assign'}
            </button>
          </div>
        )}
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
                  <div className="flex items-start gap-3">
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const newSelected = new Set(selectedLeads);
                          if (newSelected.has(lead.id)) {
                            newSelected.delete(lead.id);
                          } else {
                            newSelected.add(lead.id);
                          }
                          setSelectedLeads(newSelected);
                        }}
                        className="mt-0.5 text-gray-500 hover:text-blue-400"
                      >
                        {selectedLeads.has(lead.id) ? (
                          <CheckSquare className="w-4 h-4 text-blue-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    )}
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
                        {lead.assigned_to && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-green-500/20 text-green-400 border border-green-500/30">
                            Assigned
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
              </div>
            );
          })}
        </div>
      )}

      {/* Loading more indicator */}
      {loadingMore && (
        <div className="text-center py-6 text-gray-400 flex items-center justify-center gap-3">
          <Spinner size="sm" />
          <span>Loading more leads...</span>
        </div>
      )}
    </div>
  );
}
