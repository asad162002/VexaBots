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
    "w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition";

  return (
    <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-5 sticky top-6">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Update</h2>

      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value as LeadStatus)} className={selectClassName}>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-[#1a1a1a]">
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {profiles.length > 0 && (
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Assign To</label>
          <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className={selectClassName}>
            <option value="" className="bg-[#1a1a1a]">Unassigned</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id} className="bg-[#1a1a1a]">
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
        className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:bg-blue-800 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition disabled:cursor-not-allowed"
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}

function DateInfo({ lead }: { lead: Lead }) {
  return (
    <div className="text-xs text-gray-500 mb-4 space-y-1">
      {lead.last_contacted_at && (
        <p>Last contacted: {new Date(lead.last_contacted_at).toLocaleString()}</p>
      )}
      {lead.next_follow_up_at && (
        <p className="text-blue-400 font-medium">
          Follow-up due: {new Date(lead.next_follow_up_at).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}
