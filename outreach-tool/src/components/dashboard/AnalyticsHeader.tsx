import { type MemberStats, type LeadStatus, FUNNEL_STEPS, STATUS_COLORS, STATUS_LABELS_DISPLAY } from '@/components/dashboard/analytics-types';
import { Phone, Calendar } from 'lucide-react';

interface AnalyticsHeaderProps {
  isAdmin: boolean;
  dateFilter: string;
  setDateFilter: (v: string) => void;
  leadsCount: number;
}

export default function AnalyticsHeader({ isAdmin, dateFilter, setDateFilter, leadsCount }: AnalyticsHeaderProps) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isAdmin ? 'Team performance and lead distribution overview' : 'Your personal lead performance'}
          </p>
        </div>
        {!isAdmin && (
          <span className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-1.5">
            Member View
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="px-3 py-1.5 bg-[#27272a] border border-[#3f3f46] rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Time</option>
          <option value="30d">Last 30 Days</option>
          <option value="7d">Last 7 Days</option>
          <option value="24h">Last 24 Hours</option>
        </select>
      </div>

      <p className="text-xs text-gray-500 mt-3">
        Showing {leadsCount} lead{leadsCount !== 1 ? 's' : ''}
      </p>
    </div>
  );
}
