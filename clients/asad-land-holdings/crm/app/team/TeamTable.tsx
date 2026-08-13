"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Select } from "@/components/ui/Select";

type Employee = {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
};

export default function TeamTable({
  initialEmployees,
  currentUserId,
  currentUserRole,
}: {
  initialEmployees: Employee[];
  currentUserId: string;
  currentUserRole: string;
}) {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [error, setError] = useState<string | null>(null);
  const canManageAdmins = currentUserRole === "super_admin";

  const updateRole = async (id: string, newRole: string) => {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("employees")
      .update({ role: newRole })
      .eq("id", id);

    if (error) {
      setError(error.message);
      return;
    }

    setEmployees((prev) =>
      prev.map((e) => (e.id === id ? { ...e, role: newRole } : e))
    );
    router.refresh();
  };

  const toggleActive = async (id: string, current: boolean) => {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("employees")
      .update({ is_active: !current })
      .eq("id", id);

    if (error) {
      setError(error.message);
      return;
    }

    setEmployees((prev) =>
      prev.map((e) => (e.id === id ? { ...e, is_active: !current } : e))
    );
  };

  const roleOptions = canManageAdmins
    ? [
        { value: "employee", label: "Employee" },
        { value: "admin", label: "Admin" },
        { value: "super_admin", label: "Super Admin" },
      ]
    : [{ value: "employee", label: "Employee" }];

  return (
    <div>
      {error && <p className="text-brick text-sm mb-4">{error}</p>}

      <div className="bg-white/40 rounded-lg border border-brown-light/30 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-brown/5 text-left text-brown-light">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => {
              const isSelf = emp.id === currentUserId;
              const canEditRole = canManageAdmins && !isSelf;

              return (
                <tr key={emp.id} className="border-t border-brown-light/20">
                  <td className="px-4 py-3 text-ink font-medium">
                    {emp.name} {isSelf && <span className="text-brown-light text-xs">(you)</span>}
                  </td>
                  <td className="px-4 py-3 text-brown-light">{emp.email}</td>
                  <td className="px-4 py-3 w-40">
                    {canEditRole ? (
                      <Select
                        value={emp.role}
                        onChange={(v) => updateRole(emp.id, v)}
                        placeholder="Role"
                        options={roleOptions}
                      />
                    ) : (
                      <span className="text-brown-light capitalize">{emp.role.replace("_", " ")}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isSelf ? (
                      <span className="text-brown-light text-sm">Active</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleActive(emp.id, emp.is_active)}
                        className={`text-sm hover:underline ${
                          emp.is_active ? "text-brick" : "text-sage"
                        }`}
                      >
                        {emp.is_active ? "Deactivate" : "Activate"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-brown-light text-xs mt-4">
        New team members must first be created in Supabase Auth, then linked here with a matching account ID — this isn't a self-service signup flow yet.
      </p>
    </div>
  );
}