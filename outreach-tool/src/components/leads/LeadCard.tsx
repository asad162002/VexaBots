import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Phone } from 'lucide-react';
import { STATUS_LABELS, STATUS_COLORS, type Lead } from '@/lib/types';

interface LeadCardProps {
  lead: Lead;
  isSelected: boolean;
  toggleItem: (id: string) => void;
}

export default function LeadCard({ lead, isSelected, toggleItem }: LeadCardProps) {
  const router = useRouter();

  return (
    <Link
      href={`/dashboard/leads/${lead.id}`}
      className="block bg-[#1a1a1a] border border-[#27272a] rounded-xl p-4 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/5 transition cursor-pointer group"
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <div
          className="mt-0.5 w-5 h-5 flex items-center justify-center cursor-pointer"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleItem(lead.id);
          }}
        >
          {isSelected ? (
            <div className="w-4 h-4 bg-blue-600 rounded flex items-center justify-center">
              <svg
                className="w-3 h-3 text-white"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          ) : (
            <div className="w-4 h-4 border border-[#3f3f46] rounded" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <LeadCardContent lead={lead} />
        </div>

        <div className="shrink-0 flex items-center gap-1.5">
          {lead.website && (
            <svg
              className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          )}
          <svg
            className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </div>
    </Link>
  );
}

function LeadCardContent({ lead }: { lead: Lead }) {
  const router = useRouter();

  const statusColor = STATUS_COLORS[lead.status];
  const borderColor = statusColor
    .replace('text-', 'border-')
    .replace('-400', '-500')
    .replace('-500', '-400');

  return (
    <>
      <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
        <h3 className="font-semibold text-white text-base truncate">
          {lead.title || 'Untitled Business'}
        </h3>
        <span
          className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${statusColor} border ${borderColor}`}
        >
          {STATUS_LABELS[lead.status]}
        </span>
        {lead.icp_score !== null && (
          <span className="text-xs text-gray-400 font-semibold bg-[#27272a] px-2 py-0.5 rounded">
            ICP {lead.icp_score}
          </span>
        )}
        {lead.category_name && (
          <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
            {lead.category_name}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {lead.owner_name && (
          <span className="text-gray-400">
            Owner: <span className="text-gray-200 font-medium">{lead.owner_name}</span>
          </span>
        )}
        {lead.phone && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              navigator.clipboard.writeText(lead.phone!);
            }}
            className="text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 text-left"
            title="Click to copy phone"
          >
            <Phone className="w-3.5 h-3.5" />
            {lead.phone}
          </button>
        )}
        {lead.phone && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              router.push(`/dashboard/leads/${lead.id}`);
            }}
            className="text-green-400 hover:text-green-300 font-medium flex items-center gap-1"
            title="Call this lead"
          >
            <Phone className="w-3.5 h-3.5" />
            Call
          </button>
        )}
        {lead.city && <span className="text-gray-500">{lead.city}</span>}
      </div>

      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
        {lead.total_score && (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500/50" />
            {lead.total_score}★ ({lead.reviews_count || 0} reviews)
          </span>
        )}
        {lead.source && (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500/50" />
            {lead.source.replace('_', ' ')}
          </span>
        )}
        {lead.assigned_to && (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500/50" />
            Assigned
          </span>
        )}
        {lead.created_at && (
          <span>Added {new Date(lead.created_at).toLocaleDateString()}</span>
        )}
      </div>
    </>
  );
}
