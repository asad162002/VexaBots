import { type Lead } from '@/lib/types';

export default function LeadAdSignals({ lead }: { lead: Lead }) {
  const hasAdData = lead.running_google_ads || lead.running_fb_ads || lead.apollo_description;
  if (!hasAdData) {
    return null;
  }

  return (
    <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-5">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Ad & Enrichment Data</h2>
      <div className="space-y-3">
        {lead.running_google_ads && (
          <Badge label="Google Ads" className="bg-red-500/20 text-red-400" dot="Running ads" />
        )}
        {lead.running_fb_ads && (
          <Badge label="Facebook Ads" className="bg-blue-500/20 text-blue-400" dot="Running ads" />
        )}
        {lead.apollo_description && (
          <Field label="Apollo Description" value={lead.apollo_description} />
        )}
        {lead.apollo_revenue && (
          <Field label="Estimated Revenue" value={lead.apollo_revenue} />
        )}
        {lead.apollo_employees && (
          <Field label="Employees" value={lead.apollo_employees} />
        )}
      </div>
    </div>
  );
}

interface BadgeProps {
  label: string;
  className: string;
  dot: string;
}

function Badge({ label, className, dot }: BadgeProps) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-[11px] ${className} px-2 py-0.5 rounded-full font-semibold`}>
        {label}
      </span>
      <span className="text-sm text-gray-400">{dot}</span>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-sm text-gray-300">{value}</p>
    </div>
  );
}
