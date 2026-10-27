'use client';

import { type Lead } from '@/lib/types';
import { Copy, Phone, Mail, ExternalLink, MapPin } from 'lucide-react';

interface LeadDetailsProps {
  lead: Lead;
}

export default function LeadDetails({ lead }: LeadDetailsProps) {
  const hasData =
    lead.icp_score !== null ||
    lead.source ||
    lead.city ||
    lead.country_code ||
    lead.postal_code ||
    lead.company_size_estimate ||
    lead.owner_name ||
    lead.owner_role ||
    lead.owner_linkedin_url ||
    lead.total_score ||
    lead.reviews_count ||
    lead.website ||
    lead.place_id ||
    lead.phone ||
    lead.notes;

  if (!hasData) {
    return null;
  }

  return (
    <details className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-5">
      <summary className="cursor-pointer font-semibold text-white">Lead details</summary>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
        {lead.icp_score !== null && (
          <div>
            <p className="text-xs text-gray-500 mb-1">ICP score</p>
            <p className="text-sm font-medium text-gray-200">{lead.icp_score}</p>
          </div>
        )}
        {lead.source && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Source</p>
            <p className="text-sm font-medium text-gray-200">{lead.source.replace('_', ' ')}</p>
          </div>
        )}
        {lead.city && (
          <div>
            <p className="text-xs text-gray-500 mb-1">City</p>
            <p className="text-sm font-medium text-gray-200">{lead.city}</p>
          </div>
        )}
        {lead.country_code && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Country</p>
            <p className="text-sm font-medium text-gray-200">{lead.country_code}</p>
          </div>
        )}
        {lead.postal_code && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Postal Code</p>
            <p className="text-sm font-medium text-gray-200">{lead.postal_code}</p>
          </div>
        )}
        {lead.company_size_estimate && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Size</p>
            <p className="text-sm font-medium text-gray-200">
              {lead.company_size_estimate.charAt(0).toUpperCase() + lead.company_size_estimate.slice(1)}
            </p>
          </div>
        )}
        {lead.phone && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Phone</p>
            <div className="flex items-center gap-2">
              <Phone className="w-3 h-3 text-gray-500" />
              <span className="text-sm font-medium text-gray-200 break-all">{lead.phone}</span>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(lead.phone!)}
                className="text-xs text-blue-400 hover:text-blue-300"
                title="Copy phone"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
        {lead.owner_name && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Contact name</p>
            <p className="text-sm font-medium text-gray-200">{lead.owner_name}</p>
          </div>
        )}
        {lead.owner_role && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Contact role</p>
            <p className="text-sm font-medium text-gray-200">{lead.owner_role}</p>
          </div>
        )}
        {lead.website && (
          <div className="sm:col-span-2">
            <p className="text-xs text-gray-500 mb-1">Website</p>
            <a
              href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-400 hover:text-blue-300 break-all flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              {lead.website}
            </a>
          </div>
        )}
        {lead.place_id && (
          <div className="sm:col-span-2">
            <p className="text-xs text-gray-500 mb-1">Google Maps</p>
            <a
              href={`https://www.google.com/maps/place/?q=place_id:${lead.place_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-400 hover:text-blue-300 break-all flex items-center gap-1"
            >
              <MapPin className="w-3 h-3" />
              {lead.url || `https://www.google.com/maps/place/?q=place_id:${lead.place_id}`}
            </a>
          </div>
        )}
        {lead.owner_linkedin_url && (
          <div className="sm:col-span-2">
            <p className="text-xs text-gray-500 mb-1">LinkedIn</p>
            <a
              href={lead.owner_linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-400 hover:text-blue-300 break-all flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              {lead.owner_linkedin_url}
            </a>
          </div>
        )}
        {lead.total_score && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Rating</p>
            <p className="text-sm font-medium text-gray-200">{String(lead.total_score)}</p>
          </div>
        )}
        {lead.reviews_count && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Reviews</p>
            <p className="text-sm font-medium text-gray-200">{String(lead.reviews_count)}</p>
          </div>
        )}
      </div>
      {lead.notes && (
        <div className="mt-4 pt-4 border-t border-[#27272a]">
          <p className="text-xs text-gray-500 mb-2">Previous notes</p>
          <p className="text-sm text-gray-300 whitespace-pre-wrap break-words">{lead.notes}</p>
        </div>
      )}
      <p className="text-xs text-gray-500 mt-4">Read-only. Assign and status editing are admin-only.</p>
    </details>
  );
}
