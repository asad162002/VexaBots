import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export function SummaryCard({
  label,
  value,
  href,
  icon: Icon,
  accent = false,
  danger = false,
  trend,
}: {
  label: string;
  value: number;
  href: string;
  icon: LucideIcon;
  accent?: boolean;
  danger?: boolean;
  trend?: { previous: number; label: string };
}) {
let trendText: string | null = null;
  let trendPositive = true;

  if (trend) {
    const delta = value - trend.previous;
    trendPositive = delta >= 0;
    trendText =
      delta === 0
        ? `No change ${trend.label}`
        : `${delta > 0 ? "+" : ""}${delta} ${trend.label}`;
  }

  return (
    <Link
      href={href}
      className={`block bg-white/40 border rounded-lg p-5 hover:bg-brown/5 transition-colors ${
        danger && accent
          ? "border-brick/40"
          : accent
          ? "border-sage/40"
          : "border-brown-light/30"
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-brown-light text-sm">{label}</p>
        <Icon
          size={18}
          className={danger && accent ? "text-brick" : accent ? "text-sage" : "text-brown-light"}
        />
      </div>
      <p
        className={`text-3xl font-bold mb-1 ${
          danger && accent ? "text-brick" : accent ? "text-sage" : "text-ink"
        }`}
      >
        {value}
      </p>
      {trendText && (
        <p className={`text-xs ${trendPositive ? "text-sage" : "text-brick"}`}>{trendText}</p>
      )}
    </Link>
  );
}