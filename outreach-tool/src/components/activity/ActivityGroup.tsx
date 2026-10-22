import { type ActivityGroup, type Activity, type LeadInfo, ACTIVITY_ICONS, ACTIVITY_COLORS, STATUS_COLORS, formatDate, getTimeAgo, ChevronDown, ChevronRight } from '@/components/activity/activity-types';
import Link from 'next/link';
import { Clock } from 'lucide-react';

interface ActivityGroupProps {
  group: ActivityGroup;
  profiles: Record<string, { id: string; full_name?: string | null; email?: string | null; role?: string | null }>;
  leads: Record<string, LeadInfo>;
  isExpanded: boolean;
  onToggle: (id: string) => void;
}

export default function ActivityGroup({ group, profiles, leads, isExpanded, onToggle }: ActivityGroupProps) {
  const profile = profiles[group.profileId];
  const avatarText = profile?.full_name?.charAt(0) || profile?.email?.charAt(0) || '?';

  return (
    <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl overflow-hidden">
      <button
        onClick={() => onToggle(group.profileId)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-[#1f1f25] transition"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-300">
            {avatarText}
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-white">{group.profileName}</p>
            {group.profileEmail && group.profileName !== group.profileEmail && (
              <p className="text-xs text-gray-500">{group.profileEmail}</p>
            )}
            <p className="text-xs text-gray-500 mt-0.5">
              {group.count} {group.count === 1 ? 'activity' : 'activities'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          <span className="text-xs">{group.activities[0] && getTimeAgo(group.activities[0].created_at)}</span>
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-[#27272a]">
          {group.activities.map((activity) => (
            <ActivityItem key={activity.id} activity={activity} leads={leads} />
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityItem({ activity, leads }: { activity: Activity; leads: Record<string, LeadInfo> }) {
  const Icon = ACTIVITY_ICONS[activity.activity_type] || Clock;
  const colorClass = ACTIVITY_COLORS[activity.activity_type] || ACTIVITY_COLORS.other;
  const lead = leads[activity.lead_id];

  return (
    <div className="p-4 border-t border-[#272a] first:border-t-0">
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
              <Link
                href={`/dashboard/leads/${lead.id}`}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium truncate"
              >
                {lead.title || 'Untitled Business'}
              </Link>
            )}
            {lead && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[lead.status] || 'bg-gray-200 text-gray-500'}`}>
                {lead.status}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-300 break-words mb-1">{activity.content}</p>
          {activity.outcome && <p className="text-xs text-gray-400 mb-1">Outcome: {activity.outcome}</p>}
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
}
