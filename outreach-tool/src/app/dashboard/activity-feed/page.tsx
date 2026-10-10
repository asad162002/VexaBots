'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { type Profile } from '@/lib/types';
import Spinner from '@/components/ui/spinner';
import { Clock, Phone, MessageSquare, Mail, Calendar, FileText, ChevronDown, ChevronRight } from 'lucide-react';

interface Activity {
  id: string;
  lead_id: string;
  profile_id: string;
  activity_type: 'call' | 'text' | 'email' | 'note' | 'meeting' | 'other';
  content: string;
  outcome: string | null;
  created_at: string;
  next_follow_up_at: string | null;
}

interface ActivityGroup {
  profileId: string;
  profileName: string;
  profileEmail: string | null;
  count: number;
  activities: Activity[];
}

const ACTIVITY_ICONS = {
  call: Phone,
  text: MessageSquare,
  email: Mail,
  note: FileText,
  meeting: Calendar,
  other: Clock,
};

const ACTIVITY_COLORS = {
  call: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  text: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  email: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  note: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  meeting: 'bg-green-500/20 text-green-400 border-green-500/30',
  other: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
};

export default function ActivityFeedPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [leads, setLeads] = useState<Record<string, { id: string; title: string | null; status: string }>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchProfiles();
  }, []);

  useEffect(() => {
    if (profilesLoaded) {
      fetchActivities();
    }
  }, [profilesLoaded]);

  const fetchProfiles = async () => {
    const { data, error: profilesError } = await supabase.from('profiles').select('*');
    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
    } else if (data) {
      const profileMap: Record<string, Profile> = {};
      data.forEach((p) => { profileMap[p.id] = p; });
      setProfiles(profileMap);
    }
    setProfilesLoaded(true);
  };

  const fetchActivities = async () => {
    setLoading(true);
    setError(null);

    // Fetch recent activities (last 100)
    const { data: activitiesData, error: activitiesError } = await supabase
      .from('lead_activities')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (activitiesError) {
      console.error('Error fetching activities:', activitiesError);
      setError('Failed to load activity feed.');
      setLoading(false);
      return;
    }

    setActivities(activitiesData ?? []);
    
    // Auto-expand first group
    if (activitiesData && activitiesData.length > 0) {
      const firstProfileId = activitiesData[0].profile_id;
      setExpandedGroups({ [firstProfileId]: true });
    }

    // Fetch lead titles for activities
    const leadIds = Array.from(new Set((activitiesData ?? []).map((a) => a.lead_id)));
    if (leadIds.length > 0) {
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('id, title, status')
        .in('id', leadIds);

      if (leadsError) {
        console.error('Error fetching leads:', leadsError);
      } else if (leadsData) {
        const leadMap: Record<string, { id: string; title: string | null; status: string }> = {};
        leadsData.forEach((l) => { leadMap[l.id] = l; });
        setLeads(leadMap);
      }
    }

    setLoading(false);
  };

  // Group activities by profile
  const groupedActivities: ActivityGroup[] = [];
  const groups: Record<string, ActivityGroup> = {};

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

  Object.values(groups).forEach((group) => {
    groupedActivities.push(group);
  });

  const toggleGroup = (profileId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [profileId]: !prev[profileId],
    }));
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  const getTimeAgo = (dateStr: string) => {
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

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Activity Feed</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Team activity grouped by member ({activities.length} total activities)
          </p>
        </div>
        <button
          onClick={fetchActivities}
          className="text-xs text-gray-400 hover:text-white border border-[#27272a] hover:border-[#3f3f46] rounded-lg px-3 py-1.5 transition"
        >
          Refresh
        </button>
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
          {groupedActivities.map((group) => {
            const isExpanded = expandedGroups[group.profileId];
            const profile = profiles[group.profileId];
            const avatarText = profile?.full_name?.charAt(0) || profile?.email?.charAt(0) || '?';
            
            return (
              <div
                key={group.profileId}
                className="bg-[#1a1a1a] border border-[#27272a] rounded-xl overflow-hidden"
              >
                {/* Group header - always visible, clickable */}
                <button
                  onClick={() => toggleGroup(group.profileId)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-[#1f1f25] transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-300">
                      {avatarText}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-white">
                        {group.profileName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {group.count} {group.count === 1 ? 'activity' : 'activities'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <span className="text-xs">
                      {group.activities[0] && getTimeAgo(group.activities[0].created_at)}
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </div>
                </button>

                {/* Group content - collapsible */}
                {isExpanded && (
                  <div className="border-t border-[#27272a]">
                    {group.activities.map((activity) => {
                      const Icon = ACTIVITY_ICONS[activity.activity_type] || Clock;
                      const colorClass = ACTIVITY_COLORS[activity.activity_type] || ACTIVITY_COLORS.other;
                      const lead = leads[activity.lead_id];

                      return (
                        <div
                          key={activity.id}
                          className="p-4 border-t border-[#27272a] first:border-t-0"
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${colorClass}`}>
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorClass}`}>
                                  {activity.activity_type.charAt(0).toUpperCase() + activity.activity_type.slice(1)}
                                </span>
                                {lead && (
                                  <a
                                    href={`/dashboard/leads/${lead.id}`}
                                    className="text-xs text-blue-400 hover:text-blue-300 font-medium truncate"
                                  >
                                    {lead.title || 'Untitled Business'}
                                  </a>
                                )}
                                {lead && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    lead.status === 'new' ? 'bg-gray-100 text-gray-700' :
                                    lead.status === 'contacted' ? 'bg-blue-100 text-blue-700' :
                                    lead.status === 'interested' ? 'bg-green-100 text-green-700' :
                                    lead.status === 'not_interested' ? 'bg-red-100 text-red-700' :
                                    lead.status === 'send_info' ? 'bg-yellow-100 text-yellow-700' :
                                    lead.status === 'meeting_booked' ? 'bg-purple-100 text-purple-700' :
                                    'bg-gray-200 text-gray-500'
                                  }`}>
                                    {lead.status}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-300 break-words mb-1">{activity.content}</p>
                              {activity.outcome && (
                                <p className="text-xs text-gray-400 mb-1">Outcome: {activity.outcome}</p>
                              )}
                              {activity.next_follow_up_at && (
                                <p className="text-xs text-blue-400 mb-1">
                                  Follow-up: {new Date(activity.next_follow_up_at).toLocaleDateString()}
                                </p>
                              )}
                              <div className="flex items-center gap-3 text-xs text-gray-500">
                                <span>{getTimeAgo(activity.created_at)}</span>
                                <span>{formatDate(activity.created_at)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
