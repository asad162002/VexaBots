import { Calendar } from 'lucide-react';
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/types';
import { type Lead, type LeadStatus, type Profile } from '@/lib/types';

interface LeadHeaderProps {
  lead: Lead;
  status: LeadStatus;
  setStatus: (s: LeadStatus) => void;
  assignedTo: string;
  setAssignedTo: (s: string) => void;
  profiles: Profile[];
  onSave: () => void;
  saving: boolean;
  onBookMeeting: () => void;
}

export default function LeadHeader({
  lead,
  status,
  setStatus,
  assignedTo,
  setAssignedTo,
  profiles,
  onSave,
  saving,
  onBookMeeting,
}: LeadHeaderProps) {
  return (
    <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">
            {lead.title || 'Untitled Business'}
          </h1>
          {lead.owner_name && (
            <p className="text-gray-400 mt-1 text-sm">
              Contact: <span className="font-medium text-gray-200">{lead.owner_name}</span>
              {lead.owner_role && ` — ${lead.owner_role}`}
            </p>
          )}
        </div>
        <div className="shrink-0">
          <StatusBadge status={lead.status} />
        </div>
        {lead.assigned_to && (
          <div className="shrink-0">
            <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/30">
              Assigned
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3 mt-6">
        {lead.website && (
          <a
            href={lead.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Visit Website
          </a>
        )}
        {(lead.meeting_link || process.env.NEXT_PUBLIC_CALCOM_USERNAME) && (
          <button
            onClick={onBookMeeting}
            className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition"
          >
            <Calendar className="w-4 h-4" />
            {lead.meeting_link ? 'View Meeting' : 'Book Meeting'}
          </button>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: LeadStatus }) {
  const color = STATUS_COLORS[status];
  const borderColor = color
    .replace('text-', 'border-')
    .replace('-400', '-500')
    .replace('-500', '-400');

  return (
    <span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold ${color} border ${borderColor}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
