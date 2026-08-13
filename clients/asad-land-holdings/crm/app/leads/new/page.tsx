import { createClient } from "@/lib/supabase/server";
import NewLeadForm from "./NewLeadForm";

export default async function NewLeadPage() {
  const supabase = await createClient();

  const { data: employees } = await supabase
    .from("employees")
    .select("id, name")
    .eq("is_active", true);

  const { data: properties } = await supabase
    .from("properties")
    .select("id, location, property_type")
    .eq("status", "available");

  return (
    <div className="min-h-screen bg-cream p-4 md:p-8">
      <NewLeadForm employees={employees ?? []} properties={properties ?? []} />
    </div>
  );
}