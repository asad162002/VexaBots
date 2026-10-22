'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { STATUS_COLORS, STATUS_LABELS, type Lead, type LeadStatus, type LeadSource } from '@/lib/types';
import type { Profile } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import Spinner from '@/components/ui/spinner';
import BulkActions from '@/components/bulk-actions';
import { useBulkSelection } from '@/hooks/use-bulk-selection';
import LeadFilters from '@/components/leads/LeadFilters';
import LeadCard from '@/components/leads/LeadCard';

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<LeadSource | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'icp_high' | 'follow_up'>('newest');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [assignedFilter, setAssignedFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [followUpReminders, setFollowUpReminders] = useState<Lead[]>([]);
  const [assignLimits, setAssignLimits] = useState<Record<string, { max_leads: number; current_leads: number }>>({});

  const bulk = useBulkSelection(leads);
  const { selectedIds, setSelectedIds, toggleItem, selectAllOnPage, deselectAll, isAllSelected, isPartiallySelected } = bulk;

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounce(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    fetchLeads();
    fetchProfiles();
    fetchCategories();
    fetchFollowUpReminders();
    fetchAssignLimits();
  }, [statusFilter, sourceFilter, searchDebounce, sortBy, categoryFilter, assignedFilter]);

  const fetchAssignLimits = async () => {
    const { data, error } = await supabase
      .from('assignment_limits')
      .select('profile_id, max_leads, current_leads');

    if (error) {
      console.error('Error fetching limits:', error);
    } else {
      const limitMap: Record<string, { max_leads: number; current_leads: number }> = {};
      (data ?? []).forEach((l: any) => {
        limitMap[l.profile_id] = {
          max_leads: l.max_leads,
          current_leads: l.current_leads,
        };
      });
      setAssignLimits(limitMap);
    }
  };

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('leads')
      .select('category_name')
      .not('category_name', 'is', null);

    if (error) {
      console.error('Error fetching categories:', error);
    } else {
      const cats = [...new Set(data?.map((d) => d.category_name) || [])];
      setAvailableCategories(cats);
    }
  };

  const fetchProfiles = async () => {
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) {
      console.error('Error fetching profiles:', error);
    } else {
      setProfiles(data ?? []);
    }
  };

  const fetchFollowUpReminders = async () => {
    if (!user?.id) return;

    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const { data: reminders, error } = await supabase
      .from('leads')
      .select('*')
      .eq('assigned_to', user.id)
      .not('next_follow_up_at', 'is', null)
      .gte('next_follow_up_at', now.toISOString())
      .lte('next_follow_up_at', in24h.toISOString())
      .order('next_follow_up_at', { ascending: true })
      .limit(5);

    if (error) {
      console.error('Error fetching reminders:', error);
    } else {
      setFollowUpReminders(reminders ?? []);
    }
  };

  const handleBulkAssign = async (userId: string, notes: string, quantity?: number) => {
    const selectedIdsArray = Array.from(selectedIds);

    const limit = assignLimits[userId]?.max_leads ?? 0;
    const currentCount = assignLimits[userId]?.current_leads ?? 0;

    if (limit > 0) {
      const idsToAssign = quantity && quantity > 0 && quantity < selectedIdsArray.length
        ? selectedIdsArray.slice(0, quantity)
        : selectedIdsArray;

      if (currentCount + idsToAssign.length > limit) {
        const available = limit - currentCount;
        if (available <= 0) {
          alert(`${profiles.find(p => p.id === userId)?.email || 'This member'} has reached their maximum assignment limit of ${limit} leads.`);
          return;
        }
        const proceed = confirm(
          `${profiles.find(p => p.id === userId)?.email || 'This member'} has a limit of ${limit} leads and currently has ${currentCount}. You can only assign ${available} more. Proceed with ${available} leads?`
        );
        if (!proceed) return;
      }
    }

    const idsToAssign = quantity && quantity > 0 && quantity < selectedIdsArray.length
      ? selectedIdsArray.slice(0, quantity)
      : selectedIdsArray;

    for (const id of idsToAssign) {
      const { data: currentLead, error: fetchError } = await supabase
        .from('leads')
        .select('assigned_to')
        .eq('id', id)
        .single();

      const previousAssignee = fetchError ? null : currentLead?.assigned_to;

      const updateData: Record<string, unknown> = {
        assigned_to: userId,
        assigned_at: new Date().toISOString(),
        assigned_by: user?.id || null,
      };

      if (notes) {
        const resp = await supabase.from('leads').select('notes').eq('id', id).single();
        const existingNotes = resp.data?.notes || '';
        updateData.notes = existingNotes
          ? `${existingNotes}\n\n[${new Date().toISOString().split('T')[0]}] ${notes}`
          : notes;
      }

      const { error: updateError } = await supabase.from('leads').update(updateData).eq('id', id);
      if (updateError) {
        console.error(`Error assigning lead ${id}:`, updateError);
        continue;
      }

      await supabase.from('assignment_history').insert({
        lead_id: id,
        assigned_to: userId,
        assigned_by: user?.id || null,
        assigned_at: new Date().toISOString(),
        previous_assignee: previousAssignee,
        notes: notes || null,
      });

      const limit = assignLimits[userId];
      if (limit) {
        await supabase.from('assignment_limits').update({
          current_leads: limit.current_leads + 1,
        }).eq('profile_id', userId);
      }
    }

    await fetchLeads();
    fetchAssignLimits();
    const remainingIds = idsToAssign.filter((id) => !idsToAssign.includes(id));
    if (remainingIds.length === 0) {
      deselectAll();
    } else {
      setSelectedIds(new Set(remainingIds));
    }
  };

  const handleBulkClear = () => {
    deselectAll();
    fetchLeads();
  };

  const fetchLeads = async () => {
    setLoading(true);

    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user?.id)
      .single();

    const isAdmin = currentProfile?.role === 'admin';

    let query = supabase
      .from('leads')
      .select('*')
      .order(
        sortBy === 'icp_high'
          ? 'icp_score'
          : sortBy === 'follow_up'
            ? 'next_follow_up_at'
            : 'created_at',
        { ascending: sortBy === 'follow_up' }
      );

    if (!isAdmin && user?.id) {
      query = query.eq('assigned_to', user.id);
    }

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    if (sourceFilter !== 'all') {
      query = query.eq('source', sourceFilter);
    }

    if (categoryFilter !== 'all') {
      query = query.eq('category_name', categoryFilter);
    }

    if (assignedFilter === 'assigned') {
      query = query.not('assigned_to', 'is', null);
    } else if (assignedFilter === 'unassigned') {
      query = query.is('assigned_to', null);
    }

    if (searchDebounce.trim()) {
      const q = searchDebounce.toLowerCase().trim();
      query = query.or(
        `title.ilike.*${q}*,owner_name.ilike.*${q}*,phone.ilike.*${q}*,city.ilike.*${q}*,website.ilike.*${q}*`
      );
    }

    const { data, error } = await query.limit(100);

    if (error) {
      console.error('Error fetching leads:', error);
    }

    setLeads(data ?? []);
    setLoading(false);
  };

  const sortedLeads = [...leads].sort((a, b) => {
    if (sortBy === 'icp_high') {
      return (b.icp_score ?? 0) - (a.icp_score ?? 0);
    }
    if (sortBy === 'follow_up') {
      const aDate = a.next_follow_up_at
        ? new Date(a.next_follow_up_at).getTime()
        : Infinity;
      const bDate = b.next_follow_up_at
        ? new Date(b.next_follow_up_at).getTime()
        : Infinity;
      return aDate - bDate;
    }
    return (
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
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
          <RefreshIcon />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-4 mb-5">
        <LeadFilters
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          sourceFilter={sourceFilter}
          setSourceFilter={setSourceFilter}
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
          assignedFilter={assignedFilter}
          setAssignedFilter={setAssignedFilter}
          sortBy={sortBy}
          setSortBy={setSortBy}
          availableCategories={availableCategories}
        />
      </div>

      {/* Bulk select all checkbox */}
      {sortedLeads.length > 0 && (
        <div className="mb-3 flex items-center gap-2">
          <div
            className={`w-5 h-5 flex items-center justify-center cursor-pointer rounded border transition-colors
              ${
                isAllSelected()
                  ? 'bg-blue-600 border-blue-600'
                  : isPartiallySelected()
                    ? 'bg-blue-600/30 border-blue-600'
                    : 'border-[#3f3f46] hover:border-[#52525b]'
              }`}
            onClick={() => {
              if (isAllSelected()) {
                deselectAll();
              } else {
                selectAllOnPage();
              }
            }}
          >
            {isAllSelected() || isPartiallySelected() ? (
              <svg
                className="w-3 h-3 text-white"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            ) : null}
          </div>
          <span className="text-xs text-gray-500">
            {selectedIds.size > 0
              ? `${selectedIds.size} selected on this page`
              : 'Select all on page'}
          </span>
        </div>
      )}

      {/* Follow-up Reminders */}
      {followUpReminders.length > 0 && (
        <FollowUpReminders reminders={followUpReminders} />
      )}

      {/* Lead list */}
      {loading ? (
        <LoadingState />
      ) : sortedLeads.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-2">
          {sortedLeads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              isSelected={bulk.isSelected(lead.id)}
              toggleItem={toggleItem}
            />
          ))}
        </div>
      )}

      {/* Bulk Actions Component */}
      <BulkActions
        selectedCount={selectedIds.size}
        selectedIds={Array.from(selectedIds)}
        onAssign={handleBulkAssign}
        onClear={handleBulkClear}
        profiles={profiles}
        assignLimits={assignLimits}
      />
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="flex items-center gap-3 text-gray-500">
        <Spinner size="md" />
        <span>Loading leads...</span>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-12">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full bg-[#27272a] flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-6 h-6 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
        </div>
        <p className="text-gray-300 font-medium mb-1">No leads found</p>
        <p className="text-gray-500 text-sm">Try adjusting your filters or search query.</p>
      </div>
    </div>
  );
}

function FollowUpReminders({ reminders }: { reminders: Lead[] }) {
  return (
    <div className="mb-6 bg-yellow-500/5 border border-yellow-500/30 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-yellow-300 mb-3 flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m9-4a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        Upcoming Follow-ups
      </h2>
      <div className="space-y-2">
        {reminders.map((lead) => (
          <div key={lead.id} className="bg-[#1a1a1a] border border-[#27272a] rounded-lg p-3">
            <div className="flex items-center justify-between gap-3">
              <Link
                href={`/dashboard/leads/${lead.id}`}
                className="text-blue-400 hover:text-blue-300 font-medium text-sm truncate"
              >
                {lead.title || 'Untitled Business'}
              </Link>
              <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[lead.status]}`}>
                {STATUS_LABELS[lead.status]}
              </span>
            </div>
            {lead.next_follow_up_at && (
              <p className="text-xs text-yellow-400 mt-1">
                Due: {new Date(lead.next_follow_up_at).toLocaleString()}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
