import { type Lead, type LeadStatus, type Profile } from '@/lib/types';

interface LeadUpdatePanelProps {
  lead: Lead;
  status: LeadStatus;
  setStatus: (s: LeadStatus) => void;
  assignedTo: string;
  setAssignedTo: (s: string) => void;
  profiles: Profile[];
  onSave: () => void;
  saving: boolean;
}

const STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'interested', label: 'Interested' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'send_info', label: 'Send Info' },
  { value: 'meeting_booked', label: 'Meeting Booked' },
  { value: 'dead', label: 'Dead' },
];

export default function LeadUpdatePanel({
  lead,
  status,
  setStatus,
  assignedTo,
  setAssignedTo,
  profiles,
  onSave,
  saving,
}: LeadUpdatePanelProps) {
  const selectClassName =
    "w-full bg-card border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition";

  return (
    <div className="bg-secondary border border-border rounded-xl p-5 sticky top-6">
      <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">Update</h2>

      <div className="mb-4">
        <label className="block text-xs font-medium text-muted mb-2 uppercase tracking-wide">Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value as LeadStatus)} className={selectClassName}>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-secondary">
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {profiles.length > 0 && (
        <div className="mb-4">
          <label className="block text-xs font-medium text-muted mb-2 uppercase tracking-wide">Assign To</label>
          <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className={selectClassName}>
            <option value="" className="bg-secondary">Unassigned</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id} className="bg-secondary">
                {profile.full_name || profile.email || 'Unnamed'}
              </option>
            ))}
          </select>
        </div>
      )}

      <DateInfo lead={lead} />
      <button
        onClick={onSave}
        disabled={saving}
        className="w-full bg-primary hover:bg-primary active:bg-accent disabled:bg-primary text-foreground font-semibold rounded-lg px-4 py-2.5 text-sm transition disabled:cursor-not-allowed"
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}

function DateInfo({ lead }: { lead: Lead }) {
  return (
    <div className="text-xs text-muted mb-4 space-y-1">
      {lead.last_contacted_at && (
        <p>Last contacted: {new Date(lead.last_contacted_at).toLocaleString()}</p>
      )}
      {lead.next_follow_up_at && (
        <p className="text-accent font-medium">
          Follow-up due: {new Date(lead.next_follow_up_at).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}
