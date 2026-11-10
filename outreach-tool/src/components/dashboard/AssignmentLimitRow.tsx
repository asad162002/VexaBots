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
    <div className="bg-card rounded-xl px-4 py-3.5">
      <div className="flex items-center justify-between gap-4 mb-2.5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-card flex items-center justify-center text-xs font-bold text-muted flex-shrink-0">
            {profile.email?.charAt(0).toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="text-sm text-foreground font-medium truncate">
              {profile.email}
              {profile.id === currentUserId && ' (you)'}
            </p>
            {current > 0 && (
              <p className="text-xs text-muted mt-0.5">
                {current} assigned {limit > 0 && `of ${limit} max`}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {limit > 0 && current > 0 && (
            <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: `${Math.min(100, (current / limit) * 100)}%` }}
              />
            </div>
          )}
          <div className="flex items-center gap-1">
            <label className="text-xs text-muted">Limit:</label>
            <input
              type="number"
              min="0"
              value={limit}
              onChange={(e) => onUpdate(profile.id, parseInt(e.target.value) || 0)}
              className="w-16 bg-secondary border border-border rounded-lg px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-right"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
