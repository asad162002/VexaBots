'use client';

import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  Clipboard,
  Plus,
  Upload,
  BarChart3,
  Clock,
  Phone,
  Search,
  Command,
  Trash2,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Leads', icon: LayoutDashboard, exact: true, hiddenFromMembers: true },
  { href: '/dashboard/calls', label: 'Call Dialer', icon: Phone, hiddenFromMembers: true },
  { href: '/dashboard/my-queue', label: 'My Queue', icon: Clock },
  { href: '/dashboard/linkedin-leads', label: 'LinkedIn Leads', icon: Users, hiddenFromMembers: true },
  { href: '/dashboard/deleted-leads', label: 'Deleted Leads', icon: Trash2, hiddenFromMembers: true },
  { href: '/dashboard/assignment-log', label: 'Assignment Log', icon: Clipboard, adminOnly: true },
  { href: '/dashboard/leads/new', label: 'Add Lead', icon: Plus, adminOnly: true },
  { href: '/dashboard/import', label: 'Import CSV/JSON', icon: Upload, adminOnly: true },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/activity-feed', label: 'Activity Feed', icon: Clock },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, isAdmin, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
    const adminOnlyPaths = ['/dashboard/assignment-log', '/dashboard/leads/new', '/dashboard/import', '/dashboard/leads/', '/dashboard/calls'];
    const isCurrentAdminOnly = adminOnlyPaths.some(p => pathname.startsWith(p));
    if (!loading && user && isCurrentAdminOnly && !isAdmin) {
      router.push('/dashboard/my-queue');
    }
    if (!loading && user && !isAdmin && pathname === '/dashboard') {
      router.push('/dashboard/my-queue');
    }
  }, [user, loading, router, isAdmin, pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#08090a" }}>
        <div className="text-sm" style={{ color: "#8a8f98" }}>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen flex" style={{ background: "#08090a" }}>
      <aside className="w-60 flex flex-col fixed left-0 top-0 h-screen" style={{ background: "#0f1011", borderRight: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="flex items-center gap-2.5 px-5 h-14" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: "#5e6ad2" }}>
            <LayoutDashboard className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-medium" style={{ color: "#f7f8f8", letterSpacing: "-0.01em" }}>Vexabots</span>
          <span className="text-[10px] ml-1" style={{ color: "#62666d" }}>outreach</span>
        </div>

        <div className="px-3 pt-4 pb-2">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <Search className="w-3.5 h-3.5" style={{ color: "#62666d" }} />
            <span className="text-xs flex-1" style={{ color: "#62666d" }}>Search...</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "#8a8f98", border: "1px solid rgba(255,255,255,0.05)" }}>⌘K</span>
          </div>
        </div>

        <nav className="flex-1 py-2 px-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.filter(item => {
            if (isAdmin) return true;
            if (item.adminOnly) return false;
            if (item.hiddenFromMembers) return false;
            return true;
          }).map((item) => {
            const Icon = item.icon;
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition"
                style={{
                  background: isActive ? "rgba(94,106,210,0.15)" : "transparent",
                  color: isActive ? "#f7f8f8" : "#8a8f98",
                  fontWeight: isActive ? 510 : 400,
                  borderLeft: isActive ? "2px solid #5e6ad2" : "2px solid transparent",
                }}
              >
                <Icon className="w-4 h-4" style={{ color: isActive ? "#7170ff" : "#62666d" }} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-medium" style={{ background: "rgba(94,106,210,0.2)", color: "#7170ff" }}>
              {user.email?.charAt(0).toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium truncate" style={{ color: "#d0d6e0" }}>{user.email}</p>
              <p className="text-[10px]" style={{ color: "#62666d" }}>{isAdmin ? 'Admin' : 'Member'}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-2 w-full mt-1 px-2.5 py-1.5 text-[12px] rounded-md transition"
            style={{ color: "#8a8f98" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="ml-60 flex-1 min-h-screen">
        <div className="px-8 py-6 max-w-[1280px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
