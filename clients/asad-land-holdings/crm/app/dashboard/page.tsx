import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("name, role")
    .eq("id", user.id)
    .single();

  const role = employee?.role ?? "employee";
  const isPrivileged = ["admin", "super_admin"].includes(role);

  let leadsQuery = supabase.from("leads").select("id, budget, pipeline", { count: "exact" }).is("deleted_at", null);
  if (!isPrivileged) {
    leadsQuery = leadsQuery.eq("assigned_to", user.id);
  }
  const { data: leads, count: totalLeads } = await leadsQuery;

  const newLeads = leads?.filter((l) => l.pipeline === "new").length ?? 0;
  const ongoingLeads = leads?.filter((l) => l.pipeline === "ongoing").length ?? 0;
  const completedLeads = leads?.filter((l) => l.pipeline === "completed").length ?? 0;

  const today = new Date().toISOString().split("T")[0];
  let followUpsQuery = supabase
    .from("follow_ups")
    .select("id, follow_up_date, status, lead_id", { count: "exact" })
    .eq("status", "pending");

  const { data: followUps } = await followUpsQuery;
  const overdueFollowUps = followUps?.filter((f) => f.follow_up_date && f.follow_up_date < today).length ?? 0;
  const pendingFollowUps = followUps?.length ?? 0;

  const { count: totalProperties } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null);

  const { count: totalProjects } = await supabase
    .from("construction_projects")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null);

  return (
    <div className="min-h-screen bg-cream p-8">
      <h1 className="text-2xl font-bold text-ink mb-1">Welcome, {employee?.name ?? user.email}</h1>
      <p className="text-brown-light text-sm mb-8">Role: {role}</p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SummaryCard label="Total leads" value={totalLeads ?? 0} href="/leads" />
        <SummaryCard label="New leads" value={newLeads} href="/leads?pipeline=new" />
        <SummaryCard label="Ongoing leads" value={ongoingLeads} href="/leads?pipeline=ongoing" />
        <SummaryCard label="Completed leads" value={completedLeads} href="/leads?pipeline=completed" />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SummaryCard
          label="Pending follow-ups"
          value={pendingFollowUps}
          href="/follow-ups"
          accent={pendingFollowUps > 0}
        />
        <SummaryCard
          label="Overdue follow-ups"
          value={overdueFollowUps}
          href="/follow-ups"
          accent={overdueFollowUps > 0}
          danger
        />
        <SummaryCard label="Properties" value={totalProperties ?? 0} href="/properties" />
        <SummaryCard label="Construction projects" value={totalProjects ?? 0} href="/construction" />
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  href,
  accent = false,
  danger = false,
}: {
  label: string;
  value: number;
  href: string;
  accent?: boolean;
  danger?: boolean;
}) {
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
      <p className="text-brown-light text-sm mb-1">{label}</p>
      <p
        className={`text-3xl font-bold ${
          danger && accent ? "text-brick" : accent ? "text-sage" : "text-ink"
        }`}
      >
        {value}
      </p>
    </Link>
  );
}