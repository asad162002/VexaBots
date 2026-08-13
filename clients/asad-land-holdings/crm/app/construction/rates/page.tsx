import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import RatesTable from "./RatesTable";

const CATEGORY_LABELS: Record<string, string> = {
  grey_material: "Grey material",
  finish_material: "Finish material",
  labor: "Labor",
  setting: "Setting",
};

export default async function RatesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: employee } = await supabase
    .from("employees")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = employee?.role ?? "employee";
  if (!["admin", "super_admin"].includes(role)) {
    redirect("/dashboard");
  }

  const { data: rates, error } = await supabase
    .from("construction_rates")
    .select("id, category, key, name, qty_per_sqft, unit, price_pkr")
    .order("category")
    .order("name");

  if (error) {
    return (
      <div className="p-8">
        <p className="text-brick">Failed to load rates: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-ink">Construction Rates</h1>
        <p className="text-brown-light text-sm">{rates?.length ?? 0} total</p>
      </div>
      <p className="text-brown-light text-sm mb-6">
        These rates power the construction cost calculator on the website. Changes here
        update the calculator's estimates immediately.
      </p>
      <RatesTable initialRates={rates ?? []} categoryLabels={CATEGORY_LABELS} />
    </div>
  );
}