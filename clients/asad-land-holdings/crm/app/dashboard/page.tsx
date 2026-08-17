import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Users,
  UserPlus,
  Activity,
  CheckCircle2,
  Clock,
  AlertCircle,
  Home,
  HardHat,
} from "lucide-react";
import { PipelineChart, TrendChart } from "@/components/analytics/AnalyticsCharts";
import { DateRangeFilter } from "@/components/analytics/DateRangeFilter";
import { SummaryCard } from "@/components/analytics/SummaryCard";

function countBy(rows: { pipeline: string | null }[]) {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const value = row.pipeline ?? "unspecified";
    counts[value] = (counts[value] ?? 0) + 1;
  }
  const labels: Record<string, string> = {
    new: "New",
    ongoing: "Ongoing",
    completed: "Completed",
    unspecified: "Unspecified",
  };
  return Object.entries(counts).map(([name, value]) => ({
    name: labels[name] ?? name,
    value,
  }));
}

function getRangeStart(range: string): Date | null {
  if (range === "all") return null;
  const days = Number(range);
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  return start;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const range = params.range ?? "30";
  const rangeStart = getRangeStart(range);
  const days = range === "all" ? 90 : Number(range);
  const prevRangeStart = rangeStart ? new Date(rangeStart) : null;
  if (prevRangeStart) prevRangeStart.setDate(prevRangeStart.getDate() - days);

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

  let leadsQuery = supabase
    .from("leads")
    .select("id, budget, pipeline, created_at", { count: "exact" })
    .is("deleted_at", null);
  if (!isPrivileged) {
    leadsQuery = leadsQuery.eq("assigned_to", user.id);
  }
  if (rangeStart) {
    leadsQuery = leadsQuery.gte("created_at", rangeStart.toISOString());
  }
  const { data: leads, count: totalLeads } = await leadsQuery;

  let prevLeadsCount = 0;
  let prevNewLeadsCount = 0;
  if (rangeStart && prevRangeStart) {
    let prevQuery = supabase
      .from("leads")
      .select("id, pipeline")
      .is("deleted_at", null)
      .gte("created_at", prevRangeStart.toISOString())
      .lt("created_at", rangeStart.toISOString());
    if (!isPrivileged) prevQuery = prevQuery.eq("assigned_to", user.id);
    const { data: prevLeads } = await prevQuery;
    prevLeadsCount = prevLeads?.length ?? 0;
    prevNewLeadsCount = prevLeads?.filter((l) => l.pipeline === "new").length ?? 0;
  }

  const newLeads = leads?.filter((l) => l.pipeline === "new").length ?? 0;
  const ongoingLeads = leads?.filter((l) => l.pipeline === "ongoing").length ?? 0;
  const completedLeads = leads?.filter((l) => l.pipeline === "completed").length ?? 0;

  const today = new Date().toISOString().split("T")[0];
  const { data: followUps } = await supabase
    .from("follow_ups")
    .select("id, follow_up_date, status, created_at")
    .eq("status", "pending");

  let prevPendingFollowUpsCount = 0;
  if (rangeStart && prevRangeStart) {
    const { count } = await supabase
      .from("follow_ups")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .gte("created_at", prevRangeStart.toISOString())
      .lt("created_at", rangeStart.toISOString());
    prevPendingFollowUpsCount = count ?? 0;
  }

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

  const pipelineData = countBy(leads ?? []);

  const daysBack = range === "all" ? 90 : Number(range);
  const todayDate = new Date();
  const trendData: { date: string; count: number }[] = [];
  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date(todayDate);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    const count = (leads ?? []).filter(
      (l) => l.created_at && l.created_at.split("T")[0] === dateStr
    ).length;
    trendData.push({ date: label, count });
  }

  const trendLabel = range === "all" ? "vs. prior 90 days" : `vs. prior ${range} days`;

  return (
    <div className="min-h-screen bg-cream p-8">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Welcome, {employee?.name ?? user.email}</h1>
          <p className="text-brown-light text-sm">Role: {role}</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangeFilter basePath="/dashboard" />
          <Link href="/analytics" className="text-brown text-sm font-medium hover:text-ink whitespace-nowrap">
            View full analytics →
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5 my-8">
        <PipelineChart data={pipelineData} />
        <TrendChart data={trendData} />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SummaryCard
          label="Total leads"
          value={totalLeads ?? 0}
          href="/leads"
          icon={Users}
          trend={rangeStart ? { previous: prevLeadsCount, label: trendLabel } : undefined}
        />
        <SummaryCard
          label="New leads"
          value={newLeads}
          href="/leads?pipeline=new"
          icon={UserPlus}
          trend={rangeStart ? { previous: prevNewLeadsCount, label: trendLabel } : undefined}
        />
        <SummaryCard label="Ongoing leads" value={ongoingLeads} href="/leads?pipeline=ongoing" icon={Activity} />
        <SummaryCard label="Completed leads" value={completedLeads} href="/leads?pipeline=completed" icon={CheckCircle2} />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SummaryCard
          label="Pending follow-ups"
          value={pendingFollowUps}
          href="/follow-ups"
          icon={Clock}
          accent={pendingFollowUps > 0}
          trend={rangeStart ? { previous: prevPendingFollowUpsCount, label: trendLabel } : undefined}
        />
        <SummaryCard
          label="Overdue follow-ups"
          value={overdueFollowUps}
          href="/follow-ups"
          icon={AlertCircle}
          accent={overdueFollowUps > 0}
          danger
        />
        <SummaryCard label="Properties" value={totalProperties ?? 0} href="/properties" icon={Home} />
        <SummaryCard label="Construction projects" value={totalProjects ?? 0} href="/construction" icon={HardHat} />
      </div>
    </div>
  );
}