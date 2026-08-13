import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Pagination } from "@/components/ui/Pagination";
import { LeadFilters } from "./LeadFilters";
import { InlineAddLeadRow } from "./InlineAddLeadRow";
import Link from "next/link";

const PAGE_SIZE = 25;
const COLUMN_COUNT = 8;

type SearchParams = {
  category?: string;
  pipeline?: string;
  status?: string;
  page?: string;
};

export default async function LeadsPage({
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
    .from("leads")
    .select(
      "id, name, phone_number, category, pipeline, status, budget, follow_up_date, assigned_to, employees(name)",
      { count: "exact" }
    )
    .is("deleted_at", null)
.order("created_at", { ascending: false })
    .range(from, to);

  if (params.category) query = query.eq("category", params.category);
  if (params.pipeline) query = query.eq("pipeline", params.pipeline);
  if (params.status) query = query.eq("status", params.status);

  const { data: leads, count, error } = await query;

  if (error) {
    return (
      <div className="p-8">
        <p className="text-brick">Failed to load leads: {error.message}</p>
      </div>
    );
  }

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;
  const queryString = `${params.category ? `&category=${params.category}` : ""}${
    params.pipeline ? `&pipeline=${params.pipeline}` : ""
  }${params.status ? `&status=${params.status}` : ""}`;

  return (
    <div className="min-h-screen bg-cream p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-ink">Leads</h1>
        <p className="text-brown-light text-sm">{count ?? 0} total</p>
      </div>

      <LeadFilters
        initialCategory={params.category ?? ""}
        initialPipeline={params.pipeline ?? ""}
        initialStatus={params.status ?? ""}
      />

<div className="hidden md:block bg-white/40 rounded-lg border border-brown-light/30">        <table className="w-full text-sm">
          <thead className="bg-brown/5 text-left text-brown-light">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Pipeline</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Budget</th>
              <th className="px-4 py-3 font-medium">Follow-up</th>
              <th className="px-4 py-3 font-medium">Assigned</th>
            </tr>
          </thead>
          <tbody>
            {leads?.map((lead) => (
              <tr key={lead.id} className="border-t border-brown-light/20 hover:bg-brown/5">
                <td className="px-4 py-3">
                  <Link href={`/leads/${lead.id}`} className="text-ink font-medium hover:text-brown">
                    {lead.name ?? "—"}
                  </Link>
                </td>
                <td className="px-4 py-3 text-brown-light">{lead.phone_number}</td>
                <td className="px-4 py-3"><StatusBadge value={lead.category} variant="category" /></td>
                <td className="px-4 py-3"><StatusBadge value={lead.pipeline} variant="pipeline" /></td>
                <td className="px-4 py-3"><StatusBadge value={lead.status} /></td>
                <td className="px-4 py-3 text-brown-light">{lead.budget ?? "—"}</td>
                <td className="px-4 py-3 text-brown-light">{lead.follow_up_date ?? "—"}</td>
                <td className="px-4 py-3 text-brown-light">
                  {(lead.employees as unknown as { name: string } | null)?.name ?? "Unassigned"}
                </td>
              </tr>
            ))}
           <InlineAddLeadRow colSpan={COLUMN_COUNT} isEmpty={leads?.length === 0} />
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {leads?.map((lead) => (
          <Link
            key={lead.id}
            href={`/leads/${lead.id}`}
            className="block bg-white/40 border border-brown-light/30 rounded-lg p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-ink">{lead.name ?? "—"}</span>
              <StatusBadge value={lead.status} />
            </div>
            <p className="text-brown-light text-sm mb-2">{lead.phone_number}</p>
            <div className="flex flex-wrap gap-2">
              <StatusBadge value={lead.category} variant="category" />
              <StatusBadge value={lead.pipeline} variant="pipeline" />
            </div>
          </Link>
        ))}
        {leads?.length === 0 && (
          <p className="text-center text-brown-light py-8">No leads found.</p>
        )}
        <Link
          href="/leads/new"
          className="block text-center py-3 border border-dashed border-brown-light/40 rounded-lg text-brown font-medium text-sm"
        >
          + Add lead
        </Link>
      </div>

      <Pagination totalPages={totalPages} currentPage={page} baseUrl="/leads" queryString={queryString} />
    </div>
  );
}