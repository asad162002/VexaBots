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
  const [leads, setLeads] = useState<Record<string, LeadInfo>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [dateFilter, setDateFilter] = useState<string>('7d');

  useEffect(() => {
    fetchProfiles();
  }, []);

  useEffect(() => {
    if (profilesLoaded) fetchActivities();
  }, [profilesLoaded, dateFilter]);

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

    if (!isAdmin && user?.id) query = query.eq('profile_id', user.id);

    const dateFilterValue = getDateFilterValue(dateFilter);
    if (dateFilterValue) query = query.gte('created_at', dateFilterValue);

    const { data, error: activitiesError } = await query;
    if (activitiesError) {
      console.error('Error fetching activities:', activitiesError);
      setLoading(false);
      return;
    }

    setActivities(data ?? []);
    setExpandedGroups({});

    const leadIds = Array.from(new Set((data ?? []).map((a) => a.lead_id)));
    if (leadIds.length > 0) {
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('id, title, status')
        .in('id', leadIds);
      if (leadsError) console.error('Error fetching leads:', leadsError);
      else if (leadsData) {
        const leadMap: Record<string, LeadInfo> = {};
        leadsData.forEach((l) => { leadMap[l.id] = l; });
        setLeads(leadMap);
      }
    }
    setLoading(false);
  };

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
        <div className="flex items-center gap-3 text-gray-500">
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
          <h1 className="text-2xl font-bold text-white">Activity Feed</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isAdmin ? `Team activity grouped by member (${activities.length} total activities)` : 'Your activity history'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-1.5 bg-[#27272a] border border-[#3f3f46] rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {DATE_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <button
            onClick={fetchActivities}
            className="text-xs text-gray-400 hover:text-white border border-[#27272a] hover:border-[#3f3f46] rounded-lg px-3 py-1.5 transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {groupedActivities.length === 0 ? (
        <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-12">
          <div className="text-center">
            <Clock className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No activities logged yet.</p>
            <p className="text-gray-600 text-sm mt-1">Log activities from lead detail pages to see them here.</p>
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
