"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/Select";

export function ConstructionFilters({
  initialStatus,
}: {
  initialStatus: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    router.push(`/construction?${params.toString()}`);
  };

  const clearFilters = () => {
    setStatus("");
    router.push("/construction");
  };

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      <div className="w-48">
        <Select
          value={status}
          onChange={setStatus}
          placeholder="All statuses"
          options={[
            { value: "planning", label: "Planning" },
            { value: "in_progress", label: "In progress" },
            { value: "completed", label: "Completed" },
            { value: "on_hold", label: "On hold" },
          ]}
        />
      </div>

      <button
        type="button"
        onClick={applyFilters}
        className="px-4 py-1.5 rounded-md bg-brown text-cream text-sm font-medium"
      >
        Filter
      </button>

      {status && (
        <button
          type="button"
          onClick={clearFilters}
          className="text-brown-light text-sm hover:text-brick"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}