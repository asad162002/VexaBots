import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Pagination } from "@/components/ui/Pagination";
import { PropertyFilters } from "./PropertyFilters";
import { InlineAddPropertyRow } from "./InlineAddPropertyRow";
import Link from "next/link";

const PAGE_SIZE = 25;
const COLUMN_COUNT = 5;

type SearchParams = {
  status?: string;
  type?: string;
  page?: string;
};

export default async function PropertiesPage({
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
    .from("properties")
    .select("id, location, property_type, size, price_pkr, status", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.status) query = query.eq("status", params.status);
  if (params.type) query = query.eq("property_type", params.type);

  const { data: properties, count, error } = await query;

  if (error) {
    return (
      <div className="p-8">
        <p className="text-brick">Failed to load properties: {error.message}</p>
      </div>
    );
  }

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;
  const queryString = `${params.status ? `&status=${params.status}` : ""}${
    params.type ? `&type=${params.type}` : ""
  }`;

  return (
    <div className="min-h-screen bg-cream p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-ink">Properties</h1>
        <p className="text-brown-light text-sm">{count ?? 0} total</p>
      </div>

      <PropertyFilters initialStatus={params.status ?? ""} initialType={params.type ?? ""} />

      <div className="hidden md:block bg-white/40 rounded-lg border border-brown-light/30">
        <table className="w-full text-sm">
          <thead className="bg-brown/5 text-left text-brown-light">
            <tr>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Size</th>
              <th className="px-4 py-3 font-medium">Price (PKR)</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {properties?.map((p) => (
              <tr key={p.id} className="border-t border-brown-light/20 hover:bg-brown/5">
                <td className="px-4 py-3">
                  <Link href={`/properties/${p.id}`} className="text-ink font-medium hover:text-brown">
                    {p.location}
                  </Link>
                </td>
                <td className="px-4 py-3"><StatusBadge value={p.property_type} variant="category" /></td>
                <td className="px-4 py-3 text-brown-light">{p.size ?? "—"}</td>
                <td className="px-4 py-3 text-brown-light">
                  {p.price_pkr ? Number(p.price_pkr).toLocaleString() : "—"}
                </td>
                <td className="px-4 py-3"><StatusBadge value={p.status} /></td>
              </tr>
            ))}
            <InlineAddPropertyRow colSpan={COLUMN_COUNT} isEmpty={properties?.length === 0} />
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {properties?.map((p) => (
          <Link
            key={p.id}
            href={`/properties/${p.id}`}
            className="block bg-white/40 border border-brown-light/30 rounded-lg p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-ink">{p.location}</span>
              <StatusBadge value={p.status} />
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge value={p.property_type} variant="category" />
              {p.price_pkr && (
                <span className="text-brown-light text-sm">
                  PKR {Number(p.price_pkr).toLocaleString()}
                </span>
              )}
            </div>
          </Link>
        ))}
        {properties?.length === 0 && (
          <p className="text-center text-brown-light py-8">No properties yet.</p>
        )}
      </div>

      <Pagination totalPages={totalPages} currentPage={page} baseUrl="/properties" queryString={queryString} />
    </div>
  );
}