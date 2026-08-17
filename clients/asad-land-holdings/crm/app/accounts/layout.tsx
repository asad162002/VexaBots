import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AccountsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  return <div className="font-sans">{children}</div>;
}