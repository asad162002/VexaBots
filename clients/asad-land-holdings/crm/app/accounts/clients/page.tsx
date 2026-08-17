import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { InlineAddClientRow } from "./InlineAddClientRow";

export default async function ClientsPage() {
  const supabase = await createClient();

  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, name, phone, email, address, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="p-8">
        <p className="text-brick">Failed to load clients: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Clients</h1>
          <p className="text-brown-light text-sm mt-1">
            <Link href="/accounts" className="hover:text-ink">← Accounts overview</Link>
          </p>
        </div>
        <p className="text-brown-light text-sm">{clients?.length ?? 0} total</p>
      </div>

      <div className="bg-white/40 rounded-lg border border-brown-light/30">
        <table className="w-full text-sm">
          <thead className="bg-brown/5 text-left text-brown-light">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Address</th>
            </tr>
          </thead>
          <tbody>
            {clients?.map((c) => (
              <tr key={c.id} className="border-t border-brown-light/20 hover:bg-brown/5">
                <td className="px-4 py-3">
                  <Link href={`/accounts/clients/${c.id}`} className="text-ink font-medium hover:text-brown">
                    {c.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-brown-light">{c.phone ?? "—"}</td>
                <td className="px-4 py-3 text-brown-light">{c.email ?? "—"}</td>
                <td className="px-4 py-3 text-brown-light">{c.address ?? "—"}</td>
              </tr>
            ))}
            <InlineAddClientRow colSpan={4} isEmpty={clients?.length === 0} />
          </tbody>
        </table>
      </div>
    </div>
  );
}