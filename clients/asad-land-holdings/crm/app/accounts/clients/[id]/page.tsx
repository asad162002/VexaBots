import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ClientDetailForm from "./ClientDetailForm";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: client, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !client) {
    notFound();
  }

  const { data: projects } = await supabase
    .from("client_projects")
    .select("id, project_type, description, total_agreed_amount_pkr, status, created_at")
    .eq("client_id", id)
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-cream p-4 md:p-8">
      <ClientDetailForm client={client} projects={projects ?? []} />
    </div>
  );
}