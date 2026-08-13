"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Select } from "@/components/ui/Select";

export function InlineAddPropertyRow({
  colSpan,
  isEmpty = false,
}: {
  colSpan: number;
  isEmpty?: boolean;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [location, setLocation] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setExpanded(false);
    setLocation("");
    setPropertyType("");
    setError(null);
  };

  const handleSave = async () => {
    if (!location.trim()) {
      setError("Location is required.");
      return;
    }
    if (!propertyType) {
      setError("Property type is required.");
      return;
    }

    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.from("properties").insert({
      location: location.trim(),
      property_type: propertyType,
      status: "available",
    });

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    reset();
    router.refresh();
  };

  const circleButton = (
    <button
      type="button"
      onClick={() => setExpanded(true)}
      aria-label="Add property"
      className="w-6 h-6 rounded-full bg-brown text-cream text-sm font-bold flex items-center justify-center hover:bg-ink transition-colors"
    >
      +
    </button>
  );

  if (!expanded) {
    if (isEmpty) {
      return (
        <tr>
          <td colSpan={colSpan} className="px-4 py-3">
            <div className="flex items-center justify-center gap-3">
              {circleButton}
              <span className="text-brown-light text-sm">No properties yet, add one</span>
            </div>
          </td>
        </tr>
      );
    }

    return (
      <tr>
        <td colSpan={colSpan} className="px-4 py-3 border-t border-brown-light/20">
          <div className="flex justify-center">{circleButton}</div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-brown-light/20 bg-brown/5">
      <td className="px-4 py-2">
        <input
          autoFocus
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Location *"
          className="input"
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
        />
      </td>
      <td className="px-4 py-2">
        <Select
          value={propertyType}
          onChange={setPropertyType}
          placeholder="Type *"
          options={[
            { value: "plot", label: "Plot" },
            { value: "house", label: "House" },
            { value: "commercial", label: "Commercial" },
          ]}
        />
      </td>
      <td className="px-4 py-2" colSpan={colSpan - 2}>
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