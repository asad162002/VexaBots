import { type Lead } from '@/lib/types';

export default function LeadAddressInfo({ lead }: { lead: Lead }) {
  if (lead.address) {
    return (
      <div className="bg-secondary border border-[#27272b] rounded-xl p-5">
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">Address</h2>
        <p className="text-sm text-foreground break-all">{lead.address}</p>
      </div>
    );
  }

  if (lead.opening_hours) {
    return (
      <div className="bg-secondary border border-border rounded-xl p-5">
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">Opening Hours</h2>
        <p className="text-sm text-muted whitespace-pre-line">{lead.opening_hours}</p>
      </div>
    );
  }

  return null;
}
