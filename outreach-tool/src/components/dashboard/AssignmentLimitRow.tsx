import { type Profile } from '@/lib/types';

interface AssignmentLimitRowProps {
  profile: Profile;
  limit: number;
  current: number;
  currentUserId: string | undefined;
  onUpdate: (id: string, max: number) => void;
}

export default function AssignmentLimitRow({ profile, limit, current, currentUserId, onUpdate }: AssignmentLimitRowProps) {
  return (
    <div className="bg-[#27272a] rounded-xl px-4 py-3.5">
      <div className="flex items-center justify-between gap-4 mb-2.5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300 flex-shrink-0">
            {profile.email?.charAt(0).toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="text-sm text-white font-medium truncate">
              {profile.email}
              {profile.id === currentUserId && ' (you)'}
            </p>
            {current > 0 && (
              <p className="text-xs text-gray-500 mt-0.5">
                {current} assigned {limit > 0 && `of ${limit} max`}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {limit > 0 && current > 0 && (
            <div className="w-16 h-1.5 bg-[#3f3f46] rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${Math.min(100, (current / limit) * 100)}%` }}
              />
            </div>
          )}
          <div className="flex items-center gap-1">
            <label className="text-xs text-gray-500">Limit:</label>
            <input
              type="number"
              min="0"
              value={limit}
              onChange={(e) => onUpdate(profile.id, parseInt(e.target.value) || 0)}
              className="w-16 bg-[#1a1a1a] border border-[#3f3f46] rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
