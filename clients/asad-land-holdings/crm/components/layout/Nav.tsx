"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/leads", label: "Leads" },
  { href: "/properties", label: "Properties" },
  { href: "/construction", label: "Construction" },
  { href: "/follow-ups", label: "Follow-ups" },
  { href: "/analytics", label: "Analytics" },
];

const ADMIN_LINKS = [
  { href: "/construction/rates", label: "Rates" },
  { href: "/team", label: "Team" },
  { href: "/activity-log", label: "Activity Log" },
];

const EXTERNAL_ADMIN_LINKS = [
  { href: "/accounts", label: "Accounts & Invoicing" },
];

export function Nav({ role }: { role: string }) {
  const pathname = usePathname();
  const isAdmin = ["admin", "super_admin"].includes(role);

  const linkClass = (href: string) => {
    const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
    return `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      active ? "bg-brown text-cream" : "text-brown-light hover:text-ink hover:bg-brown/5"
    }`;
  };

  return (
    <nav className="bg-white/60 border-b border-brown-light/30 px-4 py-3">
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-ink font-bold mr-4">ALH CRM</span>
        {NAV_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className={linkClass(link.href)}>
            {link.label}
          </Link>
        ))}
        {isAdmin &&
          ADMIN_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={linkClass(link.href)}>
              {link.label}
            </Link>
          ))}
        {isAdmin &&
          EXTERNAL_ADMIN_LINKS.map((link) => (
            <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className="px-3 py-2 rounded-md text-sm font-medium text-brown-light hover:text-ink hover:bg-brown/5 transition-colors">
              {link.label} (opens in new tab)
            </a>
          ))}
      </div>
    </nav>
  );
}