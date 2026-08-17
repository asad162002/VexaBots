"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  ClientFormFields,
  ClientFormState,
} from "@/components/accounts/ClientFormFields";
import { InlineAddProjectRow } from "./InlineAddProjectRow";
import { StatusBadge } from "@/components/ui/StatusBadge";

type Project = {
  id: string;
  project_type: string | null;
  description: string | null;
  total_agreed_amount_pkr: number | null;
  status: string | null;
  created_at: string;
};

export default function ClientDetailForm({
  client,
  projects,
}: {
  client: any;
  projects: Project[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<ClientFormState>({
    name: client.name ?? "",
    phone: client.phone ?? "",
    email: client.email ?? "",
    address: client.address ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setSaved(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }

    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase
      .from("clients")
      .update({
        name: form.name.trim(),
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
      })
      .eq("id", client.id);

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSaved(true);
    router.refresh();
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href="/accounts/clients"
        className="text-brown-light text-sm hover:text-brown mb-4 inline-block"
      >
        ← Back to clients
      </Link>

      <h1 className="text-2xl font-bold text-ink mb-6">{client.name}</h1>

      <form
        onSubmit={handleSave}
        className="bg-white/40 border border-brown-light/30 rounded-lg p-6 space-y-5 mb-6"
      >
        <ClientFormFields form={form} onChange={handleChange} />
        {error && (
          <p className="text-brick text-sm" role="alert">
            {error}
          </p>
        )}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 rounded-md bg-brown text-cream font-medium hover:bg-ink transition-colors disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
          {saved && <span className="text-sage text-sm">Saved</span>}
        </div>
      </form>

      <div className="bg-white/40 border border-brown-light/30 rounded-lg p-6">
        <h2 className="text-ink font-medium mb-4">Projects</h2>

        {projects.length === 0 && (
          <p className="text-brown-light text-sm mb-4">No projects yet.</p>
        )}

        {projects.length > 0 && (
          <div className="space-y-2 mb-4">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/accounts/clients/${client.id}/projects/${p.id}`}
                className="flex items-center justify-between border-t border-brown-light/20 pt-2 hover:bg-brown/5 -mx-2 px-2"
              >
                <div>
                  <p className="text-ink text-sm font-medium capitalize">
                    {p.project_type?.replace("_", " ") ?? "Unspecified"}
                  </p>
                  <p className="text-brown-light text-xs">{p.description || "No description"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-brown-light text-sm">
                    {p.total_agreed_amount_pkr
                      ? `PKR ${Number(p.total_agreed_amount_pkr).toLocaleString()}`
                      : "—"}
                  </span>
                  <StatusBadge value={p.status} />
                </div>
              </Link>
            ))}
          </div>
        )}

        <InlineAddProjectRow clientId={client.id} />
      </div>
    </div>
  );
}