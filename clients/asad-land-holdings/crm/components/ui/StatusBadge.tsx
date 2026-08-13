type BadgeVariant = "status" | "pipeline" | "category";

const STATUS_COLORS: Record<string, string> = {
  new: "bg-brown-light/20 text-brown",
  ongoing: "bg-brick/20 text-brick",
  completed: "bg-sage text-cream",
  pending: "bg-brown-light/20 text-brown",
  done: "bg-sage/30 text-sage",
  missed: "bg-brick/20 text-brick",
  planning: "bg-brown-light/20 text-brown",
  in_progress: "bg-brick/20 text-brick",
  on_hold: "bg-brown-light/30 text-brown-light",
};

const CATEGORY_LABELS: Record<string, string> = {
  construction: "Construction",
  real_estate: "Real Estate",
  consulting: "Consulting",
};

export function StatusBadge({
  value,
  variant = "status",
}: {
  value: string | null;
  variant?: BadgeVariant;
}) {
  if (!value) {
    return <span className="text-brown-light text-sm">—</span>;
  }

  const label = variant === "category" ? CATEGORY_LABELS[value] ?? value : value;
  const colorClass = STATUS_COLORS[value] ?? "bg-brown-light/20 text-brown";

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium capitalize ${colorClass}`}
    >
      {label}
    </span>
  );
}