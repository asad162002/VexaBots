"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Select } from "@/components/ui/Select";

export function InlineAddLeadRow({
  colSpan,
  isEmpty = false,
}: {
  colSpan: number;
  isEmpty?: boolean;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setExpanded(false);
    setName("");
    setPhone("");
    setCategory("");
    setError(null);
  };

  const handleSave = async () => {
    if (!phone.trim()) {
      setError("Phone number is required.");
      return;
    }
    if (!category) {
      setError("Category is required.");
      return;
    }

    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.from("leads").insert({
      name: name.trim() || null,
      phone_number: phone.trim(),
      category,
      pipeline: "new",
      status: "active",
      source: "manual",
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
    if (isEmpty) {
      return (
        <tr>
          <td colSpan={colSpan} className="px-4 py-3">
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setExpanded(true)}
                aria-label="Add lead"
                className="w-7 h-7 rounded-full bg-brown text-cream text-base font-bold flex items-center justify-center hover:bg-ink transition-colors"
              >
                +
              </button>
              <span className="text-brown-light text-sm">No leads yet, add one</span>
            </div>
          </td>
        </tr>
      );
    }

    return (
      <tr>
        <td colSpan={colSpan} className="px-4 py-3 border-t border-brown-light/20">
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setExpanded(true)}
              aria-label="Add lead"
              className="w-7 h-7 rounded-full bg-brown text-cream text-base font-bold flex items-center justify-center hover:bg-ink transition-colors"
            >
              +
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-brown-light/20 bg-brown/5">
      <td className="px-4 py-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="input"
        />
      </td>
      <td className="px-4 py-2">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone *"
          className="input"
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
        />
      </td>
      <td className="px-4 py-2">
        <Select
          value={category}
          onChange={setCategory}
          placeholder="Category *"
          options={[
            { value: "construction", label: "Construction" },
            { value: "real_estate", label: "Real Estate" },
            { value: "consulting", label: "Consulting" },
          ]}
        />
      </td>
      <td className="px-4 py-2" colSpan={colSpan - 3}>
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
          {error && <span className="text-brick text-sm">{error}</span>}
        </div>
      </td>
    </tr>
  );
}