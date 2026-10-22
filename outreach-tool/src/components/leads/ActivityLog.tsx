import { type Lead, type Profile } from '@/lib/types';

interface ActivityLogProps {
  leadId: string;
  activities: any[];
  profiles: Profile[];
  onLogActivity: () => void;
  // Activity form state and handlers
  showForm: boolean;
  setShowForm: (v: boolean) => void;
  activityType: string;
  setActivityType: (v: string) => void;
  activityOutcome: string;
  setActivityOutcome: (v: string) => void;
  activityContent: string;
  setActivityContent: (v: string) => void;
  activityFollowUp: string;
  setActivityFollowUp: (v: string) => void;
}

export default function ActivityLog({
  activities,
  profiles,
  onLogActivity,
  showForm,
  setShowForm,
  activityType,
  setActivityType,
  activityOutcome,
  setActivityOutcome,
  activityContent,
  setActivityContent,
  activityFollowUp,
  setActivityFollowUp,
}: ActivityLogProps) {
  return (
    <div className="bg-[#1a1a1a] border border-[#27272a] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Activity Log</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-xs text-blue-400 hover:text-blue-300 font-medium"
        >
          {showForm ? 'Cancel' : '+ Log Activity'}
        </button>
      </div>

      {showForm && (
        <ActivityForm
          activityType={activityType}
          setActivityType={setActivityType}
          activityOutcome={activityOutcome}
          setActivityOutcome={setActivityOutcome}
          activityContent={activityContent}
          setActivityContent={setActivityContent}
          activityFollowUp={activityFollowUp}
          setActivityFollowUp={setActivityFollowUp}
          onSave={onLogActivity}
          onCancel={() => setShowForm(false)}
          contentError={!activityContent.trim()}
        />
      )}

      {activities.length === 0 ? (
        <p className="text-sm text-gray-500">No activities logged yet.</p>
      ) : (
        <div className="space-y-4">
          {activities.map((activity) => {
            const profile = profiles.find((p) => p.id === activity.profile_id);
            return (
              <ActivityItem
                key={activity.id}
                activity={activity}
                profileName={profile?.full_name || profile?.email || 'Unknown'}
                createdAt={new Date(activity.created_at).toLocaleString()}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function ActivityForm({
  activityType,
  setActivityType,
  activityOutcome,
  setActivityOutcome,
  activityContent,
  setActivityContent,
  activityFollowUp,
  setActivityFollowUp,
  onSave,
  onCancel,
  contentError,
}: {
  activityType: string;
  setActivityType: (v: string) => void;
  activityOutcome: string;
  setActivityOutcome: (v: string) => void;
  activityContent: string;
  setActivityContent: (v: string) => void;
  activityFollowUp: string;
  setActivityFollowUp: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  contentError: boolean;
}) {
  return (
    <div className="mb-4 p-4 bg-[#27272a]/30 border border-[#3f3f46] rounded-lg">
      <div className="grid grid-cols-2 gap-3 mb-3">
        <SelectField label="Type" value={activityType} onChange={setActivityType} options={ACTIVITY_TYPES} />
        <InputField
          label="Outcome"
          value={activityOutcome}
          onChange={setActivityOutcome}
          placeholder="e.g. Interested, No answer..."
        />
      </div>
      <TextareaField
        label="Details"
        value={activityContent}
        onChange={setActivityContent}
        placeholder="What happened in this interaction..."
      />
      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
          Next Follow-up
        </label>
        <input
          type="date"
          value={activityFollowUp}
          onChange={(e) => setActivityFollowUp(e.target.value)}
          className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={onSave}
          disabled={contentError}
          className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-green-800 text-white font-semibold rounded-lg text-sm transition disabled:cursor-not-allowed"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-[#27272a] hover:bg-[#3f3f46] text-gray-300 font-medium rounded-lg text-sm transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function ActivityItem({
  activity,
  profileName,
  createdAt,
}: {
  activity: any;
  profileName: string;
  createdAt: string;
}) {
  const typeColors: Record<string, string> = {
    call: 'bg-gray-500/20 text-gray-300',
    text: 'bg-blue-500/20 text-blue-400',
    email: 'bg-purple-500/20 text-purple-400',
    meeting: 'bg-green-500/20 text-green-400',
  };
  const color = typeColors[activity.activity_type] || 'bg-gray-500/20 text-gray-300';

  return (
    <div className="border-b border-[#27272a] last:border-0 pb-3 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${color}`}
            >
              {activity.activity_type.charAt(0).toUpperCase() + activity.activity_type.slice(1)}
            </span>
            {activity.outcome && (
              <span className="text-xs text-gray-400">{activity.outcome}</span>
            )}
          </div>
          <p className="text-sm text-gray-300 break-words">{activity.content}</p>
          {activity.next_follow_up_at && (
            <p className="text-xs text-blue-400 mt-1">
              Next follow-up: {new Date(activity.next_follow_up_at).toLocaleDateString()}
            </p>
          )}
        </div>
        <div className="text-right text-xs text-gray-500 shrink-0">
          <p>{profileName}</p>
          {createdAt}
        </div>
      </div>
    </div>
  );
}

const ACTIVITY_TYPES = [
  { value: 'call', label: 'Call' },
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'note', label: 'Note' },
  { value: 'other', label: 'Other' },
];

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-[#1a1a1a]">
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="mb-3">
      <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full bg-[#27272a] border border-[#3f3f46] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      />
    </div>
  );
}
