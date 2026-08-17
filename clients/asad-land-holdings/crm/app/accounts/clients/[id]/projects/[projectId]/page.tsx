import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ProjectDetailForm from "./ProjectDetailForm";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string; projectId: string }>;
}) {
  const { id: clientId, projectId } = await params;
  const supabase = await createClient();

  const { data: project, error } = await supabase
    .from("client_projects")
    .select("*")
    .eq("id", projectId)
    .eq("client_id", clientId)
    .single();

  if (error || !project) {
    notFound();
  }

  const { data: client } = await supabase
    .from("clients")
    .select("id, name")
    .eq("id", clientId)
    .single();

  const { data: properties } = await supabase
    .from("properties")
    .select("id, location, property_type")
    .is("deleted_at", null);

  const { data: constructionProjects } = await supabase
    .from("construction_projects")
    .select("id, project_name, location");

  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .eq("client_project_id", projectId)
    .order("issue_date", { ascending: false });

  const { data: payments } = await supabase
    .from("payments")
    .select("*, employees:payer_employee_id(id, name)")
    .eq("client_project_id", projectId)
    .order("payment_date", { ascending: false });

  const { data: expenses } = await supabase
    .from("expenses")
    .select("*, employees:funded_by_employee_id(id, name)")
    .eq("client_project_id", projectId)
    .order("date", { ascending: false });

  const { data: employees } = await supabase
    .from("employees")
    .select("id, name")
    .eq("is_active", true);

 const { data: profitLoss, error: plError } = await supabase.rpc(
    "get_project_profit_loss",
    { p_client_project_id: projectId }
  );

  return (
    <div className="min-h-screen bg-cream p-4 md:p-8">
      <ProjectDetailForm
        project={project}
        client={client}
        properties={properties ?? []}
        constructionProjects={constructionProjects ?? []}
        invoices={invoices ?? []}
        payments={payments ?? []}
        expenses={expenses ?? []}
        employees={employees ?? []}
        profitLoss={profitLoss ?? null}
        profitLossError={plError?.message ?? null}
      />
    </div>
  );
}