import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ConstructionDetailForm from "./ConstructionDetailForm";

export default async function ConstructionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project, error } = await supabase
    .from("construction_projects")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !project) {
    notFound();
  }

  const { data: leads } = await supabase
    .from("leads")
    .select("id, name, phone_number")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-cream p-4 md:p-8">
      <ConstructionDetailForm project={project} leads={leads ?? []} />
    </div>
  );
}