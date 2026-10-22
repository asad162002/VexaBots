import { type ConversionFunnel, FUNNEL_STEPS } from '@/components/dashboard/analytics-types';
import FunnelBar from '@/components/dashboard/FunnelBar';
import { CheckCircle, Calendar, Phone } from 'lucide-react';

interface MemberFunnelProps {
  funnel: ConversionFunnel;
}

export default function MemberFunnel({ funnel }: MemberFunnelProps) {
  if (!funnel || funnel.total === 0) return null;

  const calledCount = funnel.contacted + funnel.interested + funnel.send_info + funnel.meeting_booked;

  return (
    <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-5">
      <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        My Conversion Funnel
      </h2>
      <p className="text-xs text-gray-500 mb-4">
        Your lead pipeline from new to meeting booked.
      </p>

      {/* Top summary stats */}
      <div className="flex items-center justify-between mb-6">
        <StatItem value={funnel.total} label="Total" />
        <ArrowSeparator />
        <StatItemWithIcon icon={Phone} value={calledCount} label="Called" iconColor="text-blue-400" valueColor="text-blue-400" />
        <ArrowSeparator />
        <StatItemWithIcon icon={CheckCircle} value={funnel.interested + funnel.send_info + funnel.meeting_booked} label="Interested" iconColor="text-green-400" valueColor="text-green-400" />
        <ArrowSeparator />
        <StatItemWithIcon icon={Calendar} value={funnel.meeting_booked} label="Booked" iconColor="text-purple-400" valueColor="text-purple-400" />
      </div>

      {/* Funnel bars */}
      <div className="space-y-3">
        {FUNNEL_STEPS.filter(step => step.key !== 'total').map((step) => {
          const val = (funnel[step.key as keyof ConversionFunnel] || 0) as number;
          return (
            <FunnelBar
              key={step.key}
              label={step.label}
              value={val}
              total={funnel.total}
              colorKey={step.key}
            />
          );
        })}
      </div>
    </div>
  );
}

function StatItem({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

function StatItemWithIcon({ icon: Icon, value, label, iconColor, valueColor }: {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  label: string;
  iconColor?: string;
  valueColor?: string;
}) {
  return (
    <div className="text-center">
      <Icon className={`w-6 h-6 ${iconColor || 'text-gray-400'} mx-auto`} />
      <p className={`text-xl font-bold ${valueColor || 'text-white'}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

function ArrowSeparator() {
  return <span className="text-gray-500">→</span>;
}
