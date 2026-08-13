import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function ActivityLogPage() {
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

  const { data: logs, error } = await supabase
    .from("activity_logs")
    .select("id, action, entity_type, entity_id, details, created_at, employees(name)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <div className="p-8">
        <p className="text-brick">Failed to load activity log: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-ink">Activity Log</h1>
        <p className="text-brown-light text-sm">{logs?.length ?? 0} entries</p>
      </div>

      <div className="bg-white/40 rounded-lg border border-brown-light/30">
        <table className="w-full text-sm">
          <thead className="bg-brown/5 text-left text-brown-light">
            <tr>
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Who</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Entity</th>
            </tr>
          </thead>
          <tbody>
            {logs?.map((log) => {
              const employee = log.employees as unknown as { name: string } | null;
              return (
                <tr key={log.id} className="border-t border-brown-light/20">
                  <td className="px-4 py-3 text-brown-light">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-ink">{employee?.name ?? "Unknown"}</td>
                  <td className="px-4 py-3 text-brown-light">{log.action ?? "—"}</td>
                  <td className="px-4 py-3 text-brown-light">
                    {log.entity_type ?? "—"} {log.entity_id ? `#${log.entity_id.slice(0, 8)}` : ""}
                  </td>
                </tr>
              );
            })}
            {logs?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-brown-light">
                  No activity logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}