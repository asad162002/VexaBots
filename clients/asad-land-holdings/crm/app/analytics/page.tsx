import { createClient } from "@/lib/supabase/server";
import {
  PipelineChart,
  CategoryChart,
  TrendChart,
  StatusBarChart,
} from "@/components/analytics/AnalyticsCharts";
import { DateRangeFilter } from "@/components/analytics/DateRangeFilter";

function countBy<T extends Record<string, any>>(
  rows: T[],
  key: keyof T,
  labels?: Record<string, string>
) {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const raw = row[key] as string | null;
    const value = raw ?? "unspecified";
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return Object.entries(counts).map(([name, value]) => ({
    name: labels?.[name] ?? name,
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

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const range = params.range ?? "30";
  const rangeStart = getRangeStart(range);

  const supabase = await createClient();

  let leadsQuery = supabase
    .from("leads")
    .select("pipeline, category, created_at")
    .is("deleted_at", null);
  if (rangeStart) leadsQuery = leadsQuery.gte("created_at", rangeStart.toISOString());
  const { data: leads } = await leadsQuery;

  const { data: properties } = await supabase
    .from("properties")
    .select("status")
    .is("deleted_at", null);

  const { data: projects } = await supabase
    .from("construction_projects")
    .select("status")
    .is("deleted_at", null);

  const { data: followUps } = await supabase
    .from("follow_ups")
    .select("status");

  const pipelineData = countBy(leads ?? [], "pipeline", {
    new: "New",
    ongoing: "Ongoing",
    completed: "Completed",
    unspecified: "Unspecified",
  });

  const categoryData = countBy(leads ?? [], "category", {
    construction: "Construction",
    real_estate: "Real Estate",
    consulting: "Consulting",
    unspecified: "Unspecified",
  });

  const propertyData = countBy(properties ?? [], "status", {
    available: "Available",
    sold: "Sold",
    reserved: "Reserved",
    unspecified: "Unspecified",
  });

  const projectData = countBy(projects ?? [], "status", {
    planning: "Planning",
    in_progress: "In progress",
    completed: "Completed",
    on_hold: "On hold",
    unspecified: "Unspecified",
  });

  const followUpData = countBy(followUps ?? [], "status", {
    pending: "Pending",
    done: "Done",
    missed: "Missed",
    unspecified: "Unspecified",
  });

  const daysBack = range === "all" ? 90 : Number(range);
  const today = new Date();
  const trendData: { date: string; count: number }[] = [];
  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    const count = (leads ?? []).filter(
      (l) => l.created_at && l.created_at.split("T")[0] === dateStr
    ).length;
    trendData.push({ date: label, count });
  }

  return (
    <div className="min-h-screen bg-cream p-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Analytics</h1>
          <p className="text-brown-light text-sm mt-1">
            Overview across leads, properties, and construction projects
          </p>
        </div>
        <DateRangeFilter basePath="/analytics" />
      </div>

      <div className="grid md:grid-cols-2 gap-5 mb-5">
        <PipelineChart data={pipelineData} />
        <CategoryChart data={categoryData} />
      </div>

      <div className="mb-5">
        <TrendChart data={trendData} />
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        <StatusBarChart title="Properties by Status" data={propertyData} />
        <StatusBarChart title="Construction Projects by Status" data={projectData} />
        <StatusBarChart title="Follow-ups by Status" data={followUpData} />
      </div>
    </div>
  );
}