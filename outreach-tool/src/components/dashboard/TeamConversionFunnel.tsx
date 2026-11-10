import { type MemberStats, type ConversionFunnel, FUNNEL_STEPS } from '@/components/dashboard/analytics-types';

interface TeamConversionFunnelProps {
  memberStats: MemberStats[];
}

export default function TeamConversionFunnel({ memberStats }: TeamConversionFunnelProps) {
  return (
    <div className="bg-secondary border border-border rounded-xl p-5">
      <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Team Conversion Funnel
      </h2>
      <p className="text-xs text-muted mb-4">
        Lead pipeline from new to meeting booked across your team.
      </p>

      <div className="space-y-4">
        {memberStats.map((member) => {
          const total = member.funnel.total;
          if (total === 0) return null;

          const steps = FUNNEL_STEPS.filter(step => step.key !== 'total');

          return (
            <div key={member.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">
                  {member.full_name || member.email}
                </span>
                <span className="text-sm text-muted">
                  {member.funnel.meeting_booked}/{total} booked ({Math.round((member.funnel.meeting_booked / total) * 100)}%)
                </span>
              </div>
              <div className="flex items-center gap-1">
                {steps.map((step) => {
                  const val = getFunnelValue(step.key, member.funnel);
                  const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                  return (
                    <div key={step.key} className="flex-1 flex flex-col items-center">
                      <p className={`text-xs font-medium ${step.color}`}>{val}</p>
                      <p className="text-[10px] text-muted">{pct}%</p>
                    </div>
                  );
                })}
              </div>
              <div className="w-full bg-card rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-purple-500"
                  style={{
                    width: `${total > 0 ? (member.funnel.meeting_booked / total) * 100 : 0}%`
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getFunnelValue(key: string, funnel: ConversionFunnel): number {
  switch (key) {
    case 'meeting_booked': return funnel.meeting_booked;
    case 'interested': return funnel.interested;
    case 'send_info': return funnel.send_info;
    case 'contacted': return funnel.contacted;
    case 'not_interested': return funnel.not_interested;
    case 'dead': return funnel.dead;
    case 'new': return funnel.new;
    default: return 0;
  }
}
