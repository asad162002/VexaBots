"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { StatusBadge } from "@/components/ui/StatusBadge";

type FollowUp = {
  id: string;
  note: string | null;
  follow_up_date: string | null;
  status: string | null;
};

export function LeadFollowUps({
  leadId,
  initialFollowUps,
}: {
  leadId: string;
  initialFollowUps: FollowUp[];
}) {
  const router = useRouter();
  const [followUps, setFollowUps] = useState<FollowUp[]>(initialFollowUps);
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!date) {
      setError("Follow-up date is required.");
      return;
    }

    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("follow_ups")
      .insert({
        lead_id: leadId,
        note: note.trim() || null,
        follow_up_date: date,
        status: "pending",
      })
      .select("id, note, follow_up_date, status")
      .single();

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setFollowUps((prev) => [...prev, data as FollowUp]);
    setNote("");
    setDate("");
    setAdding(false);
    router.refresh();
  };

  const markDone = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("follow_ups")
      .update({ status: "done" })
      .eq("id", id);

    if (error) {
      setError(error.message);
      return;
    }

    setFollowUps((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status: "done" } : f))
    );
  };

  return (
    <div className="bg-white/40 border border-brown-light/30 rounded-lg p-6 mt-6">
      <h2 className="text-ink font-medium mb-4">Follow-ups</h2>

      {followUps.length === 0 && (
        <p className="text-brown-light text-sm mb-4">No follow-ups scheduled yet.</p>
      )}

      {followUps.length > 0 && (
        <div className="space-y-2 mb-4">
          {followUps.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between border-t border-brown-light/20 pt-2"
            >
              <div>
                <p className="text-ink text-sm">{f.note || "No note"}</p>
                <p className="text-brown-light text-xs">{f.follow_up_date}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge value={f.status} />
                {f.status === "pending" && (
                  <button
                    type="button"
                    onClick={() => markDone(f.id)}
                    className="text-sage text-xs hover:underline"
                  >
                    Mark done
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!adding ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="text-brown text-sm font-medium hover:text-ink"
        >
          + Add follow-up
        </button>
      ) : (
        <div className="space-y-2 border-t border-brown-light/20 pt-3">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            className="input"
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input"
          />
          {error && <p className="text-brick text-sm">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving}
              className="px-3 py-1.5 rounded-md bg-brown text-cream text-sm font-medium disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setError(null);
              }}
              className="px-3 py-1.5 rounded-md text-brown-light text-sm hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}