import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function AccountsHomePage() {
  const supabase = await createClient();

  const { count: clientCount } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true });

  const { count: activeProjectCount } = await supabase
    .from("client_projects")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  const { data: unpaidInvoices } = await supabase
    .from("invoices")
    .select("amount_pkr")
    .neq("status", "paid");

  const totalOutstanding = (unpaidInvoices ?? []).reduce(
    (sum, inv) => sum + (Number(inv.amount_pkr) || 0),
    0
  );

  return (
    <div className="min-h-screen bg-cream p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink">Accounts & Invoicing</h1>
        <p className="text-brown-light text-sm mt-1">Asad Land Holdings — internal financial records</p>
      </div>

      <nav className="flex gap-2 mb-8 bg-white/60 border border-brown-light/30 rounded-lg p-1 w-fit">
        <Link href="/accounts" className="px-4 py-2 rounded-md bg-brown text-cream text-sm font-medium">
          Overview
        </Link>
        <Link href="/accounts/clients" className="px-4 py-2 rounded-md text-brown-light hover:text-ink text-sm font-medium">
          Clients
        </Link>
      </nav>

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white/40 border border-brown-light/30 rounded-lg p-5">
          <p className="text-brown-light text-sm mb-1">Total clients</p>
          <p className="text-3xl font-bold text-ink">{clientCount ?? 0}</p>
        </div>
        <div className="bg-white/40 border border-brown-light/30 rounded-lg p-5">
          <p className="text-brown-light text-sm mb-1">Active projects</p>
          <p className="text-3xl font-bold text-ink">{activeProjectCount ?? 0}</p>
        </div>
        <div className="bg-white/40 border border-brick/30 rounded-lg p-5">
          <p className="text-brown-light text-sm mb-1">Total outstanding</p>
          <p className="text-3xl font-bold text-brick">
            PKR {totalOutstanding.toLocaleString()}
          </p>
        </div>
      </div>

      <Link
        href="/accounts/clients"
        className="inline-block px-4 py-2 rounded-md bg-brown text-cream text-sm font-medium"
      >
        Manage clients →
      </Link>
    </div>
  );
}