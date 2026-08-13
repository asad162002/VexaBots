import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import LeadDetailForm from "./LeadDetailForm";
import { LeadFollowUps } from "./LeadFollowUps";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: lead, error } = await supabase
    .from("leads")
    .select("*, employees(id, name)")
    .eq("id", id)
    .single();

  if (error || !lead) {
    notFound();
  }

  const { data: employees } = await supabase
    .from("employees")
    .select("id, name")
    .eq("is_active", true);

  const { data: properties } = await supabase
    .from("properties")
    .select("id, location, property_type")
    .eq("status", "available");

  const { data: followUps } = await supabase
    .from("follow_ups")
    .select("id, note, follow_up_date, status")
    .eq("lead_id", id)
    .order("follow_up_date", { ascending: true });

  return (
    <div className="min-h-screen bg-cream p-4 md:p-8">
      <LeadDetailForm
        lead={lead}
        employees={employees ?? []}
        properties={properties ?? []}
      />
      <div className="max-w-3xl mx-auto">
        <LeadFollowUps leadId={id} initialFollowUps={followUps ?? []} />
      </div>
    </div>
  );
}