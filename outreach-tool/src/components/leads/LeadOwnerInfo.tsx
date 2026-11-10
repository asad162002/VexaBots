import { type Lead } from '@/lib/types';

export default function LeadOwnerInfo({ lead }: { lead: Lead }) {
  if (!lead.owner_name) {
    return null;
  }

  return (
    <div className="bg-secondary border border-border rounded-xl p-5">
      <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">Owner / Contact</h2>
      <div className="space-y-3">
        <InfoItem label="Name" value={lead.owner_name} />
        {lead.owner_role && <InfoItem label="Role" value={lead.owner_role} muted />}
        {lead.owner_linkedin_url && (
          <div>
            <p className="text-xs text-muted mb-1">LinkedIn</p>
            <a
              href={lead.owner_linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:text-accent text-sm break-all"
            >
              {lead.owner_linkedin_url}
            </a>
          </div>
        )}
        {lead.owner_snippet && <InfoItem label="Notes" value={lead.owner_snippet} muted />}
      </div>
    </div>
  );
}

function InfoItem({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className={muted ? "text-muted text-sm" : "text-foreground font-medium"}>{value}</p>
    </div>
  );
}
