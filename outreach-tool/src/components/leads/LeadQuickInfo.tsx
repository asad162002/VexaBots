import { Copy } from 'lucide-react';
import { type Lead } from '@/lib/types';

export default function LeadQuickInfo({ lead }: { lead: Lead }) {
  return (
    <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-5">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Quick Info</h2>
      <div className="grid grid-cols-2 gap-4">
        <InfoItem label="ICP Score" value={lead.icp_score !== null ? String(lead.icp_score) : '-'} />
        {lead.phone && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Phone</p>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(lead.phone!)}
              className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 font-medium"
              title="Click to copy phone number"
            >
              {lead.phone}
              <Copy className="w-3 h-3" />
            </button>
          </div>
        )}
        {lead.meeting_link && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Meeting Link</p>
            <a
              href={lead.meeting_link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 text-sm break-all"
            >
              {lead.meeting_link.replace('https://', '')}
            </a>
          </div>
        )}
        <InfoItem label="Source" value={lead.source.replace('_', ' ')} />
        {lead.city && <InfoItem label="City" value={lead.city} />}
        {lead.country_code && <InfoItem label="Country" value={lead.country_code} />}
        {lead.postal_code && <InfoItem label="Postal Code" value={lead.postal_code} />}
        {lead.company_size_estimate && (
          <InfoItem
            label="Size"
            value={lead.company_size_estimate.charAt(0).toUpperCase() + lead.company_size_estimate.slice(1)}
          />
        )}
        {lead.ad_running && <InfoItem label="Running Ads" value="Yes" />}
        {lead.total_score && <InfoItem label="Rating" value={String(lead.total_score)} />}
        {lead.reviews_count && <InfoItem label="Reviews" value={String(lead.reviews_count)} />}
        {lead.place_id && (
          <div className="sm:col-span-2">
            <p className="text-xs text-gray-500 mb-1">Google Maps</p>
            <a
              href={`https://www.google.com/maps/place/?q=place_id:${lead.place_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 text-sm break-all flex items-center gap-1"
            >
              {lead.url || `https://www.google.com/maps/place/?q=place_id:${lead.place_id}`}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-sm font-medium text-gray-200">{value}</p>
    </div>
  );
}
