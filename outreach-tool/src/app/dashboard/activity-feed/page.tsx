'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { type Profile } from '@/lib/types';
import Spinner from '@/components/ui/spinner';
import { Clock } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import ActivityGroup from '@/components/activity/ActivityGroup';
import { type Activity, type ActivityGroup as ActivityGroupType, type LeadInfo, DATE_FILTERS } from '@/components/activity/activity-types';

function ActivityFeedPage() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  // Titles and status can come from either table, since an activity points at
  // a lead in one of the two.
  const [leads, setLeads] = useState<Record<string, LeadInfo>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  // Default is All Time. A rolling 7-day default silently hid older history,
  // which reads as data loss rather than a filter.
  const [dateFilter, setDateFilter] = useState<string>('all');

  const fetchProfiles = async () => {
    const { data, error: profilesError } = await supabase.from('profiles').select('*');
    if (profilesError) console.error('Error fetching profiles:', profilesError);
    else if (data) {
      const profileMap: Record<string, Profile> = {};
      data.forEach((p) => { profileMap[p.id] = p; });
      setProfiles(profileMap);
      setIsAdmin(profileMap[user?.id || '']?.role === 'admin');
    }
    setProfilesLoaded(true);
  };

  const getDateFilterValue = (filter: string): string | null => {
    if (filter === 'all') return null;
    const now = new Date();
    let pastDate: Date;
    if (filter === '24h') pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    else if (filter === '7d') pastDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    else if (filter === '30d') pastDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    else return null;
    return pastDate.toISOString();
  };

  const fetchActivities = async () => {
    setLoading(true);
    let query = supabase
      .from('lead_activities')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    // Members see their own work. RLS permits any signed-in user to read all
    // rows, so this filter is what actually scopes a member's view.
    if (!isAdmin && user?.id) query = query.eq('profile_id', user.id);

    const dateFilterValue = getDateFilterValue(dateFilter);
    if (dateFilterValue) query = query.gte('created_at', dateFilterValue);

    const { data, error: activitiesError } = await query;
    if (activitiesError) {
      console.error('Error fetching activities:', activitiesError);
      setLoading(false);
      return;
    }

    const rows = data ?? [];
    setActivities(rows);
    setExpandedGroups({});

    const leadIds = Array.from(new Set(rows.map((a) => a.lead_id)));
    if (leadIds.length === 0) {
      setLoading(false);
      return;
    }

    // Resolve names and status across both tables. An activity row only records
    // lead_table, so checking just `leads` left every LinkedIn activity nameless
    // and unlinked. linkedin_leads has no status column, hence the fallback.
    const [mapsData, linkedInData] = await Promise.all([
      supabase.from('leads').select('id, title, status').in('id', leadIds),
      supabase.from('linkedin_leads').select('id, lead_name').in('id', leadIds),
    ]);

    if (mapsData.error) console.error('Error fetching leads:', mapsData.error);
    if (linkedInData.error) console.error('Error fetching linkedin leads:', linkedInData.error);

    const leadMap: Record<string, LeadInfo> = {};
    (mapsData.data ?? []).forEach((l: { id: string; title: string | null; status: string }) => {
      leadMap[l.id] = { id: l.id, title: l.title, status: l.status };
    });
    // LinkedIn rows fill only gaps, so a Google Maps lead that also has an
    // archived mirror keeps its real name.
    (linkedInData.data ?? []).forEach((l: { id: string; lead_name: string | null }) => {
      if (!leadMap[l.id]) {
        leadMap[l.id] = { id: l.id, title: l.lead_name, status: 'new' };
      }
    });

    setLeads(leadMap);
    setLoading(false);
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  useEffect(() => {
    if (profilesLoaded) fetchActivities();
  }, [profilesLoaded, dateFilter]);

  const groupedActivities: ActivityGroupType[] = useMemo(() => {
    const groups: Record<string, ActivityGroupType> = {};
    activities.forEach((activity) => {
      const profileId = activity.profile_id;
      if (!groups[profileId]) {
        const profile = profiles[profileId];
        groups[profileId] = {
          profileId,
          profileName: profile?.full_name || profile?.email || 'Unknown',
          profileEmail: profile?.email || null,
          count: 0,
          activities: [],
        };
      }
      groups[profileId].count += 1;
      groups[profileId].activities.push(activity);
    });
    return Object.values(groups);
  }, [activities, profiles]);

  const toggleGroup = (profileId: string) => {
    setExpandedGroups((prev) => ({ ...prev, [profileId]: !prev[profileId] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex items-center gap-3 text-muted">
          <Spinner size="md" />
          <span>Loading activity feed...</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Activity Feed</h1>
          <p className="text-sm text-muted mt-0.5">
            {isAdmin
              ? `Team activity grouped by member (${activities.length} total activities)`
              : `Your activity (${activities.length} total activities)`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-1.5 bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary [&>option]:bg-secondary [&>option]:text-foreground"
          >
            {DATE_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <button
            onClick={fetchActivities}
            className="text-xs text-muted hover:text-foreground border border-border hover:border-border rounded-lg px-3 py-1.5 transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {dateFilter !== 'all' && (
        <p className="mb-3 text-xs text-muted">
          Showing only the selected period. Older activities exist; switch to All Time to see them.
        </p>
      )}

      {groupedActivities.length === 0 ? (
        <div className="bg-secondary border border-border rounded-xl p-12">
          <div className="text-center">
            <Clock className="w-10 h-10 text-muted mx-auto mb-3" />
            <p className="text-muted">No activities logged yet.</p>
            <p className="text-muted text-sm mt-1">Log activities from lead detail pages to see them here.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {groupedActivities.map((group) => (
            <ActivityGroup
              key={group.profileId}
              group={group}
              profiles={profiles}
              leads={leads}
              isExpanded={expandedGroups[group.profileId] ?? false}
              onToggle={toggleGroup}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default ActivityFeedPage;
