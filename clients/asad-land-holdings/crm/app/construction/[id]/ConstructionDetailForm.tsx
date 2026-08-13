"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { StatusBadge } from "@/components/ui/StatusBadge";
import Link from "next/link";
import {
  ConstructionFormFields,
  ConstructionFormState,
} from "@/components/construction/ConstructionFormFields";

type Lead = { id: string; name: string | null; phone_number: string };

export default function ConstructionDetailForm({
  project,
  leads,
}: {
  project: any;
  leads: Lead[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<ConstructionFormState>({
    project_name: project.project_name ?? "",
    lead_id: project.lead_id ?? "",
    location: project.location ?? "",
    size_sqft: project.size_sqft?.toString() ?? "",
    budget_estimate_pkr: project.budget_estimate_pkr?.toString() ?? "",
    status: project.status ?? "",
    start_date: project.start_date ?? "",
    expected_end_date: project.expected_end_date ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setSaved(false);
  };

  const handleFieldChange = (name: keyof ConstructionFormState, value: string) => {
    setForm({ ...form, [name]: value });
    setSaved(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.project_name.trim()) {
      setError("Project name is required.");
      return;
    }

    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase
      .from("construction_projects")
      .update({
        project_name: form.project_name.trim(),
        lead_id: form.lead_id || null,
        location: form.location || null,
        size_sqft: form.size_sqft ? Number(form.size_sqft) : null,
        budget_estimate_pkr: form.budget_estimate_pkr ? Number(form.budget_estimate_pkr) : null,
        status: form.status || null,
        start_date: form.start_date || null,
        expected_end_date: form.expected_end_date || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", project.id);

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSaved(true);
    router.refresh();
  };

const handleDelete = async () => {
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("construction_projects")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", project.id);

    setDeleting(false);

    if (error) {
      setError(error.message);
      setShowDeleteConfirm(false);
      return;
    }

    router.push("/construction");
    router.refresh();
  };
  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href="/construction"
        className="text-brown-light text-sm hover:text-brown mb-4 inline-block"
      >
        ← Back to projects
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-ink">{project.project_name}</h1>
        <div className="flex items-center gap-2">
          <StatusBadge value={form.status} />
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="ml-3 text-brick text-sm hover:underline"
          >
            Delete project
          </button>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="bg-brick/10 border border-brick/30 rounded-lg p-4 mb-6">
          <p className="text-ink text-sm mb-3">
Delete this project? It will be hidden from the projects list but not permanently removed.          </p>
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

      <div className="bg-sage/10 border border-sage/30 rounded-lg p-4 mb-6">
        <p className="text-brown-light text-xs uppercase tracking-wide mb-1">
          Actual cost (synced from Accounts tool)
        </p>
        <p className="text-ink text-xl font-semibold">
          {project.actual_cost_pkr
            ? `PKR ${Number(project.actual_cost_pkr).toLocaleString()}`
            : "Not yet synced"}
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="bg-white/40 border border-brown-light/30 rounded-lg p-6 space-y-5"
      >
        <ConstructionFormFields
          form={form}
          onChange={handleChange}
          onFieldChange={handleFieldChange}
          leads={leads}
        />
        {error && (
          <p className="text-brick text-sm" role="alert">
            {error}
          </p>
        )}
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