'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Filter, Users, Mail, ExternalLink, Copy, Shield, Trash2 } from 'lucide-react';
import Spinner from '@/components/ui/spinner';
import { useAuth } from '@/lib/auth-context';
import { useBulkSelection } from '@/hooks/use-bulk-selection';

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
  deleted_at: string | null;
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
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [profiles, setProfiles] = useState<{ id: string; full_name: string | null; email: string | null; role: string }[]>([]);
  const [assignQuantity, setAssignQuantity] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const observer = useRef<IntersectionObserver | null>(null);
  const lastLeadRef = useRef<HTMLDivElement | null>(null);

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
    checkRole();
  }, [user]);

  const fetchLeads = useCallback(async (offset = 0) => {
    if (offset === 0) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      let placeIds: string[] = [];

      // For members, first get the place_ids of leads assigned to them
      if (user && user.id && !isAdmin) {
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
      }

      let query = supabase
        .from('linkedin_leads')
        .select('*', { count: 'exact' })
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      // Members only see LinkedIn leads for leads assigned to them
      if (!isAdmin && placeIds.length > 0) {
        query = query.in('place_id', placeIds);
      } else if (!isAdmin && placeIds.length === 0) {
        // No assigned leads means no results
        query = query.eq('id', '00000000-0000-0000-0000-000000000000');
      }

      if (sourceFilter !== 'all') {
        query = query.eq('source', sourceFilter);
      }

      if (emailFilter === 'verified') {
        query = query.not('email', 'is', null).neq('email', '');
      } else if (emailFilter === 'not_found') {
        query = query.or('email.is.null,email.eq.');
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
  }, [sourceFilter, emailFilter, isAdmin, user]);

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
    if (loadingRole) return;
    setLeads([]);
    setHasMore(true);
    fetchLeads(0);
  }, [sourceFilter, emailFilter, isAdmin, loadingRole, fetchLeads]);

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

  const bulk = useBulkSelection<LinkedInLead>(filteredLeads);
  const { selectedIds, setSelectedIds, toggleItem, selectAllOnPage, deselectAll, isSelected, isAllSelected, isPartiallySelected } = bulk;

  const copyToClipboard = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const archiveLead = async (id: string) => {
    if (!confirm('Archive this lead? It will move to Deleted Leads.')) return;
    const { error } = await supabase
      .from('linkedin_leads')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      alert('Failed to archive: ' + error.message);
      return;
    }
    await supabase.from('lead_activities').insert({
      lead_id: id,
      profile_id: user?.id || null,
      activity_type: 'other',
      content: 'Lead archived',
      lead_table: 'linkedin_leads',
    });
    setLeads((prev) => prev.filter((l) => l.id !== id));
  };

  const bulkArchive = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Archive ${selectedIds.size} selected lead(s)?`)) return;
    const ids = Array.from(selectedIds);
    const { error } = await supabase
      .from('linkedin_leads')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', ids);
    if (error) { alert('Failed: ' + error.message); return; }
    await Promise.all(ids.map((id) => supabase.from('lead_activities').insert({
      lead_id: id,
      profile_id: user?.id || null,
      activity_type: 'other',
      content: 'Lead archived',
      lead_table: 'linkedin_leads',
    })));
    setLeads((prev) => prev.filter((l) => !selectedIds.has(l.id)));
    deselectAll();
  };

  const openAssign = async () => {
    if (selectedIds.size === 0) return;
    const { data } = await supabase.from('profiles').select('id, full_name, email, role');
    setProfiles(data ?? []);
    setAssigning(true);
  };

  const assignTo = async (userId: string) => {
    if (selectedIds.size === 0) return;
    setSubmitting(true);
    const ids = Array.from(selectedIds);
    const quantity = assignQuantity ? parseInt(assignQuantity, 10) : undefined;
    const idsToAssign = quantity && quantity > 0 && quantity < ids.length ? ids.slice(0, quantity) : ids;
    const { error } = await supabase
      .from('linkedin_leads')
      .update({ assigned_to: userId, assigned_at: new Date().toISOString(), assigned_by: user?.id })
      .in('id', idsToAssign);
    if (!error) {
      await Promise.all(idsToAssign.map((id) => supabase.from('lead_activities').insert({
        lead_id: id,
        profile_id: userId,
        activity_type: 'other',
        content: `Assigned to ${profiles.find(p => p.id === userId)?.full_name || profiles.find(p => p.id === userId)?.email || 'member'}${assignNotes ? `: ${assignNotes}` : ''}`,
        lead_table: 'linkedin_leads',
      })));
    }
    setSubmitting(false);
    if (error) { alert('Failed to assign: ' + error.message); return; }
    setAssigning(false);
    setAssignQuantity('');
    setAssignNotes('');
    deselectAll();
  };

  const EmailIcon = ({ status }: { status: string | null }) => {
    if (status === 'verified') {
      return <Mail className="w-4 h-4 text-green-400" />;
    }
    return <Mail className="w-4 h-4 text-muted" />;
  };

  if (loadingRole || (loading && leads.length === 0)) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="flex items-center gap-3 text-muted">
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
          <h1 className="text-2xl font-bold text-foreground">LinkedIn Leads</h1>
          <p className="text-sm text-muted mt-1">
            Enriched contacts with LinkedIn profiles, emails, and titles for your outreach.
          </p>
        </div>
        {!isAdmin && (
          <span className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-1.5">
            Member View
          </span>
        )}
        <Link href="/dashboard/linkedin-leads/deleted" className="text-sm text-muted hover:text-accent ml-2">
          Deleted Leads
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-secondary border border-border rounded-xl p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search leads..."
              className="w-full bg-card border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
            />
          </div>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
          >
            {SOURCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-secondary">
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={emailFilter}
            onChange={(e) => setEmailFilter(e.target.value as typeof emailFilter)}
            className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition [&>option]:bg-secondary [&>option]:text-foreground [&>option:hover]:bg-primary/30"
          >
            <option value="all" className="bg-secondary">All Emails</option>
            <option value="verified" className="bg-secondary">Has Email</option>
            <option value="not_found" className="bg-secondary">No Email</option>
          </select>
        </div>
      </div>

      {/* Results summary */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted">
          {filteredLeads.length} leads found
        </p>
      </div>

      {/* Bulk selection toolbar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-10">
          <div className="flex items-center gap-3 bg-secondary border border-border rounded-xl px-4 py-3 shadow-lg shadow-black/30">
            <span className="text-sm text-muted">
              <span className="font-medium text-foreground">{selectedIds.size}</span> selected
            </span>
            <div className="w-px h-5 bg-card" />
            <button
              onClick={openAssign}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-foreground bg-primary hover:bg-primary rounded-lg transition"
            >
              Assign
            </button>
            <button
              onClick={bulkArchive}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/10 rounded-lg transition"
            >
              <Trash2 className="w-4 h-4" />
              Archive
            </button>
            <button
              onClick={() => deselectAll()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-muted hover:text-foreground hover:bg-card rounded-lg transition"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {assigning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-secondary border border-border rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Assign {selectedIds.size} lead{selectedIds.size !== 1 ? 's' : ''}
            </h3>
            <div className="space-y-3">
              {profiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => assignTo(profile.id)}
                  disabled={submitting}
                  className="w-full flex items-center gap-3 p-3 text-left bg-card hover:bg-[#333336] rounded-lg transition disabled:opacity-50"
                >
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-foreground">
                    {profile.full_name?.charAt(0) || profile.email?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {profile.full_name || profile.email}
                    </p>
                    <p className="text-xs text-muted capitalize">{profile.role}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-4">
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wide">
                How many? (leave empty for all)
              </label>
              <input
                type="number"
                value={assignQuantity}
                onChange={(e) => setAssignQuantity(e.target.value)}
                placeholder="e.g. 50"
                min="1"
                max={selectedIds.size}
                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
              />
            </div>

            <div className="mt-4">
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wide">
                Notes (optional)
              </label>
              <textarea
                value={assignNotes}
                onChange={(e) => setAssignNotes(e.target.value)}
                placeholder="Add a note about this assignment..."
                rows={2}
                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setAssigning(false)}
                disabled={submitting}
                className="px-4 py-2 text-sm text-muted hover:text-foreground hover:bg-card rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leads list */}
      {filteredLeads.length === 0 && !loading ? (
        <div className="text-center py-12">
          <Users className="w-8 h-8 text-muted mx-auto mb-3" />
          <p className="text-muted">No leads found</p>
          <p className="text-xs text-muted mt-1">
            Upload a JSON file with enrichment data to populate this page.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredLeads.length > 0 && (
            <div className="flex items-center gap-2">
              <div
                className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer ${
                  isAllSelected() || isPartiallySelected()
                    ? 'bg-primary/30 border-primary'
                    : 'border-border hover:border-[#52525b]'
                }`}
                onClick={() => {
                  if (isAllSelected()) deselectAll();
                  else selectAllOnPage();
                }}
              >
                {(isAllSelected() || isPartiallySelected()) && (
                  <svg className="w-3 h-3 text-foreground" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <span className="text-xs text-muted">
                {selectedIds.size > 0 ? `${selectedIds.size} selected on this page` : 'Select all on page'}
              </span>
            </div>
          )}
          {filteredLeads.map((lead, index) => {
            const isLast = index === filteredLeads.length - 1;
            const showObserver = isLast && filteredLeads.length > 0;

            return (
              <div
                key={lead.id}
                ref={showObserver ? lastLeadRef : null}
                className="bg-secondary border border-border rounded-xl p-4 hover:border-primary/50 hover:shadow-lg transition group"
              >
                <div className="flex items-start justify-between gap-4">
                  <input
                    type="checkbox"
                    checked={isSelected(lead.id)}
                    onChange={() => toggleItem(lead.id)}
                    className="accent-primary mt-1 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                      <h3 className="font-semibold text-foreground text-base truncate">
                        <Link href={`/dashboard/linkedin-leads/${lead.id}`}>
                          {lead.lead_name || 'Untitled Contact'}
                        </Link>
                      </h3>
                      {lead.source && (
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                          lead.source === 'apollo_enrichment'
                            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                            : 'bg-primary/20 text-accent border border-primary/30'
                        }`}>
                          {lead.source === 'apollo_enrichment' ? 'Apollo' : 'LinkedIn'}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm mb-2">
                      {lead.title && (
                        <span className="text-muted">
                          {lead.title}
                        </span>
                      )}
                      {lead.email && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(lead.email!)}
                          className="text-accent hover:text-accent font-medium flex items-center gap-1 group/inline"
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
                        <span className="text-muted italic">No email</span>
                      )}
                    </div>

                    {lead.linkedin_url && (
                      <div className="flex items-center gap-1 text-xs text-muted">
                        <ExternalLink className="w-3 h-3" />
                        <a
                          href={lead.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-accent truncate"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {lead.linkedin_url.replace('https://www.', '').replace('https://', '')}
                        </a>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => archiveLead(lead.id)}
                    className="text-muted hover:text-red-400 transition p-1"
                    title="Archive lead"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Loading more indicator */}
      {loadingMore && (
        <div className="text-center py-6 text-muted flex items-center justify-center gap-3">
          <Spinner size="sm" />
          <span>Loading more leads...</span>
        </div>
      )}
    </div>
  );
}
