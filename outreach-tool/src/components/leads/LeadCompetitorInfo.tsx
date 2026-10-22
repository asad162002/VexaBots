import { type Lead } from '@/lib/types';

export default function LeadCompetitorInfo({ lead }: { lead: Lead }) {
  // Parse source_details JSON if it's a string
  const details = typeof lead.source_details === 'string' 
    ? JSON.parse(lead.source_details) 
    : lead.source_details;
  const competitors = details?.competitors;

  if (!competitors || !Array.isArray(competitors) || competitors.length === 0) {
    return null;
  }

  return (
    <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-5">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Competitors</h2>
      <div className="space-y-2">
        {competitors.map((c: Record<string, unknown>, idx: number) => (
          <div key={idx} className="flex items-center justify-between">
            <span className="text-sm text-gray-200">
              {(c.name as string) ?? 'Unknown'}
            </span>
            {c.reviews != null && (
              <span className="text-xs text-gray-500">
                {String(c.reviews)} reviews{c.rating != null && c.reviews != null && ` | ${String(c.rating)}★`}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
