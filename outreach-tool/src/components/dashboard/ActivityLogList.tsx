import { type ActivityEntry } from '@/components/dashboard/analytics-types';

interface ActivityLogListProps {
  title: string;
  description: string;
  activityLog: ActivityEntry[];
  leadsReceivedLog: ActivityEntry[];
  showReceived: boolean;
}

export default function ActivityLogList({
  title,
  description,
  activityLog,
  leadsReceivedLog,
  showReceived = false,
}: ActivityLogListProps) {
  const hasContent = activityLog.length > 0 || (showReceived && leadsReceivedLog.length > 0);

  return (
    <div className="bg-secondary border border-border rounded-xl p-5">
      <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m9-4a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {title}
      </h2>
      <p className="text-xs text-muted mb-4">{description}</p>

      {!hasContent ? (
        <p className="text-xs text-muted py-4 text-center">No recent activity.</p>
      ) : (
        <div className="space-y-2">
          {showReceived && leadsReceivedLog.map((entry) => (
            <ActivityItem key={entry.id} entry={entry} dotColor="bg-green-400" />
          ))}
          {activityLog.map((entry) => (
            <ActivityItem key={entry.id} entry={entry} dotColor="bg-accent" />
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityItem({ entry, dotColor }: { entry: ActivityEntry; dotColor: string }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-card rounded-lg">
      <div className={`w-2 h-2 rounded-full ${dotColor} flex-shrink-0`} />
      <div className="flex-1">
        <p className="text-sm text-foreground">{entry.description}</p>
        <p className="text-xs text-muted mt-0.5">
          {new Date(entry.timestamp).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}
