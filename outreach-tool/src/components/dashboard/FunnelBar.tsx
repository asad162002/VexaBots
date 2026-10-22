import { type ConversionFunnel, FUNNEL_STEPS } from '@/components/dashboard/analytics-types';
import { CheckCircle } from 'lucide-react';

const STEP_COLORS: Record<string, string> = {
  new: '#9ca3af',
  contacted: '#60a5fa',
  interested: '#4ade80',
  send_info: '#facc15',
  meeting_booked: '#a78bfa',
  not_interested: '#f87171',
  dead: '#6b7280',
};

interface FunnelBarProps {
  label: string;
  value: number;
  total: number;
  colorKey: string;
}

export default function FunnelBar({ label, value, total, colorKey }: FunnelBarProps) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const barColor = STEP_COLORS[colorKey] || '#fff';

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 w-32">
        <span className="text-sm font-medium" style={{ color: barColor }}>{label}</span>
      </div>
      <div className="flex-1">
        <div className="w-full bg-[#27272a] rounded-full h-4">
          <div
            className="h-4 rounded-full transition-all"
            style={{ width: `${pct}%`, backgroundColor: barColor }}
          />
        </div>
      </div>
      <div className="w-16 text-right">
        <span className="text-sm font-medium" style={{ color: barColor }}>{value}</span>
        <span className="text-xs text-gray-500 ml-2">({pct}%)</span>
      </div>
    </div>
  );
}
