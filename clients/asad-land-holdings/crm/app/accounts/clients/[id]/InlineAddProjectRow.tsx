"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Select } from "@/components/ui/Select";

export function InlineAddProjectRow({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [projectType, setProjectType] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setExpanded(false);
    setProjectType("");
    setDescription("");
    setError(null);
  };

  const handleSave = async () => {
    if (!projectType) {
      setError("Project type is required.");
      return;
    }

    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.from("client_projects").insert({
      client_id: clientId,
      project_type: projectType,
      description: description.trim() || null,
      status: "active",
    });

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    reset();
    router.refresh();
  };

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="text-brown text-sm font-medium hover:text-ink"
      >
        + Add project
      </button>
    );
  }

  return (
    <div className="border-t border-brown-light/20 pt-3 space-y-2">
      <Select
        value={projectType}
        onChange={setProjectType}
        placeholder="Project type *"
        options={[
          { value: "sale_purchase", label: "Sale / Purchase" },
          { value: "construction", label: "Construction" },
          { value: "consultancy", label: "Consultancy" },
        ]}
      />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        className="input"
      />
      {error && <p className="text-brick text-sm">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 rounded-md bg-brown text-cream text-sm font-medium disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={reset}
          className="px-3 py-1.5 rounded-md text-brown-light text-sm hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}