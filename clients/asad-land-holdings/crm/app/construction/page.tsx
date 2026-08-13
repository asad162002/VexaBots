import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Pagination } from "@/components/ui/Pagination";
import { ConstructionFilters } from "./ConstructionFilters";
import { InlineAddProjectRow } from "./InlineAddProjectRow";
import Link from "next/link";

const PAGE_SIZE = 25;
const COLUMN_COUNT = 6;

type SearchParams = {
  status?: string;
  page?: string;
};

export default async function ConstructionPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? "1");
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  let query = supabase
    .from("construction_projects")
    .select(
      "id, project_name, location, size_sqft, budget_estimate_pkr, actual_cost_pkr, status",
      { count: "exact" }
    )
.is("deleted_at", null)
    .order("created_at", { ascending: false })    .range(from, to);

  if (params.status) query = query.eq("status", params.status);

  const { data: projects, count, error } = await query;

  if (error) {
    return (
      <div className="p-8">
        <p className="text-brick">Failed to load projects: {error.message}</p>
      </div>
    );
  }

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;
  const queryString = params.status ? `&status=${params.status}` : "";

  return (
    <div className="min-h-screen bg-cream p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-ink">Construction Projects</h1>
        <p className="text-brown-light text-sm">{count ?? 0} total</p>
      </div>

      <ConstructionFilters initialStatus={params.status ?? ""} />

      <div className="hidden md:block bg-white/40 rounded-lg border border-brown-light/30">
        <table className="w-full text-sm">
          <thead className="bg-brown/5 text-left text-brown-light">
            <tr>
              <th className="px-4 py-3 font-medium">Project</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Size (sqft)</th>
              <th className="px-4 py-3 font-medium">Budget (PKR)</th>
              <th className="px-4 py-3 font-medium">Actual cost (PKR)</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {projects?.map((p) => (
              <tr key={p.id} className="border-t border-brown-light/20 hover:bg-brown/5">
                <td className="px-4 py-3">
                  <Link href={`/construction/${p.id}`} className="text-ink font-medium hover:text-brown">
                    {p.project_name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-brown-light">{p.location ?? "—"}</td>
                <td className="px-4 py-3 text-brown-light">{p.size_sqft ?? "—"}</td>
                <td className="px-4 py-3 text-brown-light">
                  {p.budget_estimate_pkr ? Number(p.budget_estimate_pkr).toLocaleString() : "—"}
                </td>
                <td className="px-4 py-3 text-brown-light">
                  {p.actual_cost_pkr ? Number(p.actual_cost_pkr).toLocaleString() : "—"}
                </td>
                <td className="px-4 py-3"><StatusBadge value={p.status} /></td>
              </tr>
            ))}
            <InlineAddProjectRow colSpan={COLUMN_COUNT} isEmpty={projects?.length === 0} />
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {projects?.map((p) => (
          <Link
            key={p.id}
            href={`/construction/${p.id}`}
            className="block bg-white/40 border border-brown-light/30 rounded-lg p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-ink">{p.project_name}</span>
              <StatusBadge value={p.status} />
            </div>
            <p className="text-brown-light text-sm">{p.location ?? "—"}</p>
          </Link>
        ))}
        {projects?.length === 0 && (
          <p className="text-center text-brown-light py-8">No projects yet.</p>
        )}
      </div>

      <Pagination totalPages={totalPages} currentPage={page} baseUrl="/construction" queryString={queryString} />
    </div>
  );
}