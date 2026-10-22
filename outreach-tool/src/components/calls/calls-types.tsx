import { Phone, Clock, CheckCircle, XCircle, PlayCircle, ExternalLink } from 'lucide-react';

type CallStatus = 'answered' | 'busy' | 'no_answer' | 'voicemail' | 'initiated' | 'ringing' | 'disconnected' | string;

interface CallLog {
  id: string;
  lead_id: string;
  caller_id: string;
  from_number: string;
  to_number: string;
  status: string;
  duration_seconds: number | null;
  recorded_url: string | null;
  created_at: string;
}

interface LeadWithCallStatus {
  id: string;
  title: string | null;
  owner_name: string | null;
  phone: string | null;
  status: string | null;
  source: string | null;
  icp_score: number | null;
  call_logs: CallLog[];
  last_call?: CallLog | null;
}

export type { CallLog, LeadWithCallStatus };

export const STATUS_COLORS: Record<string, string> = {
  answered: 'bg-green-500/20 text-green-400 border-green-500/30',
  busy: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  no_answer: 'bg-red-500/20 text-red-400 border-red-500/30',
  voicemail: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  initiated: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  ringing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  disconnected: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  default: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

export const STATUS_LABELS: Record<string, string> = {
  answered: 'Answered',
  busy: 'Busy',
  no_answer: 'No Answer',
  voicemail: 'Voicemail',
  initiated: 'Dialing',
  ringing: 'Ringing',
  disconnected: 'Disconnected',
};

export const getStatusColor = (status: string | null): string => {
  if (!status) return STATUS_COLORS.default;
  return STATUS_COLORS[status] || STATUS_COLORS.default;
};

export const getStatusLabel = (status: string | null): string => {
  if (!status) return 'Unknown';
  return STATUS_LABELS[status] || status;
};

interface CallControlsProps {
  selectedProfile: string;
  profiles: { id: string; full_name: string | null; email: string | null; phone_number: string | null }[];
  filterStatus: 'all' | 'called' | 'not_called';
  onCallerChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onFilterChange: (v: 'all' | 'called' | 'not_called') => void;
  searchQuery: string;
  onSearchChange: (v: string) => void;
  leadsCount: number;
  calledCount: number;
  pendingCount: number;
}

export function CallControls({
  selectedProfile, profiles, filterStatus, onCallerChange, onFilterChange,
  searchQuery, onSearchChange, leadsCount, calledCount, pendingCount,
}: CallControlsProps) {
  return (
    <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Caller</label>
          <select
            value={selectedProfile}
            onChange={onCallerChange}
            className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select caller...</option>
            {profiles.map(p => (
              <option key={p.id} value={p.id}>
                {p.full_name || p.email} ({p.phone_number})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Filter</label>
          <select
            value={filterStatus}
            onChange={(e) => onFilterChange(e.target.value as 'all' | 'called' | 'not_called')}
            className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Leads</option>
            <option value="called">Called</option>
            <option value="not_called">Not Called</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Search</label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Lead name, phone..."
            className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Stats</label>
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-gray-400">Total</span>
              <span className="text-white font-bold"> {leadsCount}</span>
            </div>
            <div>
              <span className="text-gray-400">Called</span>
              <span className="text-green-400 font-bold"> {calledCount}</span>
            </div>
            <div>
              <span className="text-gray-400">Pending</span>
              <span className="text-yellow-400 font-bold"> {pendingCount}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface CallLeadRowProps {
  lead: LeadWithCallStatus;
  selectedProfile: string;
  submitting: boolean;
  onCall: (id: string) => void;
}

export function CallLeadRow({ lead, selectedProfile, submitting, onCall }: CallLeadRowProps) {
  const lastCall = lead.last_call;
  const hasCalled = lastCall !== null && lastCall?.status !== 'initiated';

  return (
    <tr className="hover:bg-[#27272a]/30">
      <td className="px-4 py-3">
        <div>
          <p className="text-sm font-medium text-white">{lead.title || 'Untitled'}</p>
          {lead.owner_name && <p className="text-xs text-gray-500">{lead.owner_name}</p>}
        </div>
      </td>
      <td className="px-4 py-3">
        {lead.phone ? (
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <Phone className="w-3 h-3 text-gray-500" />
            {lead.phone}
          </div>
        ) : <span className="text-xs text-gray-500">N/A</span>}
      </td>
      <td className="px-4 py-3">
        {lead.icp_score !== null ? (
          <span className="text-sm text-white">{lead.icp_score}</span>
        ) : <span className="text-xs text-gray-500">N/A</span>}
      </td>
      <td className="px-4 py-3">
        {hasCalled && lastCall ? (
          <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${getStatusColor(lastCall.status)}`}>
            {getStatusLabel(lastCall.status)}
          </span>
        ) : <span className="text-xs text-gray-500">Not called</span>}
      </td>
      <td className="px-4 py-3">
        {lastCall?.duration_seconds ? (
          <div className="flex items-center gap-1.5 text-sm text-gray-300">
            <Clock className="w-3 h-3 text-gray-500" />
            {lastCall.duration_seconds}s
          </div>
        ) : <span className="text-xs text-gray-500">N/A</span>}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {lead.phone && selectedProfile && (
            <button
              onClick={() => onCall(lead.id)}
              disabled={submitting}
              className="text-blue-400 hover:text-blue-300 disabled:opacity-50 transition"
              title={hasCalled ? 'Call again' : 'Call now'}
            >
              <Phone className="w-4 h-4" />
            </button>
          )}
          {lastCall?.recorded_url && (
            <a
              href={lastCall.recorded_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 transition"
              title="Listen to recording"
            >
              <PlayCircle className="w-4 h-4" />
            </a>
          )}
          {lead.id && (
            <a
              href={`/dashboard/leads/${lead.id}`}
              className="text-gray-400 hover:text-gray-300 transition"
              title="View lead details"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </td>
    </tr>
  );
}
