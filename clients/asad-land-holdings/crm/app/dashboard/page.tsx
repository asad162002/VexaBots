import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("name, role")
    .eq("id", user.id)
    .single();

  return (
    <div className="min-h-screen bg-cream p-8">
      <h1 className="text-2xl font-bold text-ink">
        Welcome, {employee?.name ?? user.email}
      </h1>
      <p className="text-brown-light mt-1">Role: {employee?.role}</p>
    </div>
  );
}