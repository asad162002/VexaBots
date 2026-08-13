import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/ui/StatusBadge";
import Link from "next/link";

export default async function FollowUpsPage() {
  const supabase = await createClient();

  const { data: followUps, error } = await supabase
    .from("follow_ups")
    .select("id, note, follow_up_date, status, lead_id, employee_id, leads(id, name, phone_number), employees(name)")
    .order("follow_up_date", { ascending: true });

  if (error) {
    return (
      <div className="p-8">
        <p className="text-brick">Failed to load follow-ups: {error.message}</p>
      </div>
    );
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="min-h-screen bg-cream p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-ink">Follow-ups</h1>
        <p className="text-brown-light text-sm">{followUps?.length ?? 0} total</p>
      </div>

      <div className="hidden md:block bg-white/40 rounded-lg border border-brown-light/30">
        <table className="w-full text-sm">
          <thead className="bg-brown/5 text-left text-brown-light">
            <tr>
              <th className="px-4 py-3 font-medium">Lead</th>
              <th className="px-4 py-3 font-medium">Note</th>
              <th className="px-4 py-3 font-medium">Due date</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Assigned</th>
            </tr>
          </thead>
          <tbody>
            {followUps?.map((f) => {
              const lead = f.leads as unknown as { id: string; name: string | null; phone_number: string } | null;
              const employee = f.employees as unknown as { name: string } | null;
              const isOverdue = f.status === "pending" && f.follow_up_date && f.follow_up_date < today;

              return (
                <tr key={f.id} className="border-t border-brown-light/20 hover:bg-brown/5">
                  <td className="px-4 py-3">
                    {lead ? (
                      <Link href={`/leads/${lead.id}`} className="text-ink font-medium hover:text-brown">
                        {lead.name || lead.phone_number}
                      </Link>
                    ) : (
                      <span className="text-brown-light">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-brown-light">{f.note ?? "—"}</td>
                  <td className={`px-4 py-3 ${isOverdue ? "text-brick font-medium" : "text-brown-light"}`}>
                    {f.follow_up_date ?? "—"}
                    {isOverdue && " (overdue)"}
                  </td>
                  <td className="px-4 py-3"><StatusBadge value={f.status} /></td>
                  <td className="px-4 py-3 text-brown-light">{employee?.name ?? "Unassigned"}</td>
                </tr>
              );
            })}
            {followUps?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-brown-light">
                  No follow-ups yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {followUps?.map((f) => {
          const lead = f.leads as unknown as { id: string; name: string | null; phone_number: string } | null;
          return (
            <div key={f.id} className="bg-white/40 border border-brown-light/30 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-ink">
                  {lead ? lead.name || lead.phone_number : "—"}
                </span>
                <StatusBadge value={f.status} />
              </div>
              <p className="text-brown-light text-sm">{f.note ?? "—"}</p>
              <p className="text-brown-light text-sm mt-1">Due: {f.follow_up_date ?? "—"}</p>
            </div>
          );
        })}
        {followUps?.length === 0 && (
          <p className="text-center text-brown-light py-8">No follow-ups yet.</p>
        )}
      </div>
    </div>
  );
}