"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/Select";

export function LeadFilters({
  initialCategory,
  initialPipeline,
  initialStatus,
}: {
  initialCategory: string;
  initialPipeline: string;
  initialStatus: string;
}) {
  const router = useRouter();
  const [category, setCategory] = useState(initialCategory);
  const [pipeline, setPipeline] = useState(initialPipeline);
  const [status, setStatus] = useState(initialStatus);

  const hasActiveFilters = Boolean(category || pipeline || status);

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (pipeline) params.set("pipeline", pipeline);
    if (status) params.set("status", status);
    router.push(`/leads?${params.toString()}`);
  };

  const clearFilters = () => {
    setCategory("");
    setPipeline("");
    setStatus("");
    router.push("/leads");
  };

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      <div className="w-48">
        <Select
          value={category}
          onChange={setCategory}
          placeholder="All categories"
          options={[
            { value: "construction", label: "Construction" },
            { value: "real_estate", label: "Real Estate" },
            { value: "consulting", label: "Consulting" },
          ]}
        />
      </div>

      <div className="w-48">
       <Select
          value={pipeline}
          onChange={setPipeline}
          placeholder="All pipeline stages"
          options={[
            { value: "new", label: "New" },
            { value: "ongoing", label: "Ongoing" },
            { value: "completed", label: "Completed" },
          ]}
        />
      </div>

      <div className="w-48">
        <Select
          value={status}
          onChange={setStatus}
          placeholder="All statuses"
          options={[
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
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