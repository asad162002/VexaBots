import { type MemberStats, type LeadStatus, STATUS_LABELS_DISPLAY, STATUS_COLORS } from '@/components/dashboard/analytics-types';
import type { ConversionFunnel } from '@/components/dashboard/analytics-types';
import { Phone, Calendar } from 'lucide-react';

interface TeamPerformanceCardProps {
  member: MemberStats;
  allFunnelData: ConversionFunnel;
}

export default function TeamPerformanceCard({ member, allFunnelData }: TeamPerformanceCardProps) {
  const hasLeads = member.leads_assigned > 0;
  const calledCount = member.funnel.contacted + member.funnel.interested + member.funnel.send_info + member.funnel.meeting_booked;
  const bookedCount = member.funnel.meeting_booked;
  const conversionRate = hasLeads
    ? Math.round(
        ((member.funnel.meeting_booked +
          member.funnel.interested +
          member.funnel.send_info) /
          member.leads_assigned) *
          100
      )
    : 0;

  return (
    <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-300 flex-shrink-0">
          {member.full_name
            ? member.full_name.charAt(0).toUpperCase()
            : (member.email?.charAt(0).toUpperCase() ?? '?')}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">
            {member.full_name || member.email || 'Unknown'}
          </p>
          {member.role && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              member.role === 'admin'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
            }`}>
              {member.role}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-center mb-3">
        <Stat value={member.leads_assigned} label="Assigned Leads" />
        <Stat value={`${conversionRate}%`} label="Est. Conversion" valueColor="text-green-400" />
        <StatWithIcon icon={Phone} value={calledCount} label="Called" iconColor="text-blue-400" />
        <StatWithIcon icon={Calendar} value={bookedCount} label="Booked" iconColor="text-purple-400" valueColor="text-purple-400" />
      </div>

      {hasLeads && Object.values(member.leads_by_status).some(v => v > 0) && (
        <div className="flex flex-wrap gap-1">
          {Object.entries(member.leads_by_status).map(([status, count]) => {
            if (count === 0) return null;
            const s = status as LeadStatus;
            return (
              <div key={status} className="flex items-center gap-1 text-xs" title={`${STATUS_LABELS_DISPLAY[s]}: ${count}`}>
                <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[s]}`} />
                <span className="text-gray-400">{count}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface StatProps {
  value: string | number;
  label: string;
  valueColor?: string;
}

function Stat({ value, label, valueColor }: StatProps) {
  return (
    <div>
      <p className={`text-2xl font-bold ${valueColor || 'text-white'}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

function StatWithIcon({ icon: Icon, value, label, iconColor, valueColor }: {
  icon: React.ComponentType<{ className?: string }>;
  value: string | number;
  label: string;
  iconColor?: string;
  valueColor?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-center gap-1">
        <Icon className={`w-4 h-4 ${iconColor || 'text-gray-400'}`} />
        <p className={`text-xl font-bold ${valueColor || 'text-white'}`}>{value}</p>
      </div>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
