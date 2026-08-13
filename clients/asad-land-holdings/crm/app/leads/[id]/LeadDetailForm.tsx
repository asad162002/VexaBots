"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { StatusBadge } from "@/components/ui/StatusBadge";
import Link from "next/link";
import { LeadFormFields, LeadFormState } from "@/components/leads/LeadFormFields";

type Employee = { id: string; name: string };
type Property = { id: string; location: string; property_type: string };

export default function LeadDetailForm({
  lead,
  employees,
  properties,
}: {
  lead: any;
  employees: Employee[];
  properties: Property[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<LeadFormState>({
    name: lead.name ?? "",
    phone_number: lead.phone_number ?? "",
    category: lead.category ?? "",
    pipeline: lead.pipeline ?? "",
    status: lead.status ?? "",
    budget: lead.budget ?? "",
    timeline: lead.timeline ?? "",
    location: lead.location ?? "",
    follow_up_date: lead.follow_up_date ?? "",
    assigned_to: lead.assigned_to ?? "",
    interested_property_id: lead.interested_property_id ?? "",
    conversation_summary: lead.conversation_summary ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setSaved(false);
  };

  const handleFieldChange = (name: keyof LeadFormState, value: string) => {
    setForm({ ...form, [name]: value });
    setSaved(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("leads")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", lead.id);

    setDeleting(false);

    if (error) {
      setError(error.message);
      setShowDeleteConfirm(false);
      return;
    }

    router.push("/leads");
    router.refresh();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase
      .from("leads")
      .update({
        ...form,
        name: form.name || null,
        category: form.category || null,
        pipeline: form.pipeline || null,
        status: form.status || null,
        budget: form.budget || null,
        timeline: form.timeline || null,
        location: form.location || null,
        follow_up_date: form.follow_up_date || null,
        assigned_to: form.assigned_to || null,
        interested_property_id: form.interested_property_id || null,
        conversation_summary: form.conversation_summary || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead.id);

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSaved(true);
    router.refresh();
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/leads" className="text-brown-light text-sm hover:text-brown mb-4 inline-block">
        ← Back to leads
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-ink">{lead.name || lead.phone_number}</h1>
        <div className="flex items-center gap-2">
          <StatusBadge value={form.pipeline} variant="pipeline" />
          <StatusBadge value={form.status} />
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="ml-3 text-brick text-sm hover:underline"
          >
            Delete lead
          </button>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="bg-brick/10 border border-brick/30 rounded-lg p-4 mb-6">
          <p className="text-ink text-sm mb-3">
            Delete this lead? It will be hidden from the leads list but not permanently removed.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-3 py-1.5 rounded-md bg-brick text-cream text-sm font-medium disabled:opacity-60"
            >
              {deleting ? "Deleting..." : "Yes, delete"}
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="px-3 py-1.5 rounded-md text-brown-light text-sm hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white/40 border border-brown-light/30 rounded-lg p-6 space-y-5">
        <LeadFormFields
          form={form}
          onChange={handleChange}
          onFieldChange={handleFieldChange}
          employees={employees}
          properties={properties}
          phoneRequired
        />
        {error && <p className="text-brick text-sm" role="alert">{error}</p>}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 rounded-md bg-brown text-cream font-medium hover:bg-ink transition-colors disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
          {saved && <span className="text-sage text-sm">Saved</span>}
        </div>
      </form>
    </div>
  );
}