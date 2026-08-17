"use client";

import { useRouter, useSearchParams } from "next/navigation";

const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

export function DateRangeFilter({ basePath }: { basePath: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("range") ?? "30";

  const handleChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", value);
    router.push(`${basePath}?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-1 bg-white/40 border border-brown-light/30 rounded-md p-1">
      {RANGES.map((r) => (
        <button
          key={r.value}
          type="button"
          onClick={() => handleChange(r.value)}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            current === r.value
              ? "bg-brown text-cream"
              : "text-brown-light hover:text-ink"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}