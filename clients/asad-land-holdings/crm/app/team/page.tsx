import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import TeamTable from "./TeamTable";

export default async function TeamPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: currentEmployee } = await supabase
    .from("employees")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = currentEmployee?.role ?? "employee";
  if (!["admin", "super_admin"].includes(role)) {
    redirect("/dashboard");
  }

  const { data: employees, error } = await supabase
    .from("employees")
    .select("id, name, email, role, is_active, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    return (
      <div className="p-8">
        <p className="text-brick">Failed to load team: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-ink">Team</h1>
        <p className="text-brown-light text-sm">{employees?.length ?? 0} total</p>
      </div>
      <TeamTable
        initialEmployees={employees ?? []}
        currentUserId={user.id}
        currentUserRole={role}
      />
    </div>
  );
}