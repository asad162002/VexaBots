"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/Select";

export function PropertyFilters({
  initialStatus,
  initialType,
}: {
  initialStatus: string;
  initialType: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [type, setType] = useState(initialType);

  const hasActiveFilters = Boolean(status || type);

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (type) params.set("type", type);
    router.push(`/properties?${params.toString()}`);
  };

  const clearFilters = () => {
    setStatus("");
    setType("");
    router.push("/properties");
  };

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      <div className="w-48">
        <Select
          value={type}
          onChange={setType}
          placeholder="All types"
          options={[
            { value: "plot", label: "Plot" },
            { value: "house", label: "House" },
            { value: "commercial", label: "Commercial" },
          ]}
        />
      </div>

      <div className="w-48">
        <Select
          value={status}
          onChange={setStatus}
          placeholder="All statuses"
          options={[
            { value: "available", label: "Available" },
            { value: "sold", label: "Sold" },
            { value: "reserved", label: "Reserved" },
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

      {hasActiveFilters && (
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