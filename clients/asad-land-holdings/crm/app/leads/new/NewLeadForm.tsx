"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { LeadFormFields, LeadFormState } from "@/components/leads/LeadFormFields";

type Employee = { id: string; name: string };
type Property = { id: string; location: string; property_type: string };

const EMPTY_FORM: LeadFormState = {
  name: "",
  phone_number: "",
  category: "",
  pipeline: "new",
  status: "active",
  budget: "",
  timeline: "",
  location: "",
  follow_up_date: "",
  assigned_to: "",
  interested_property_id: "",
  conversation_summary: "",
};

export default function NewLeadForm({
  employees,
  properties,
}: {
  employees: Employee[];
  properties: Property[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<LeadFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleFieldChange = (name: keyof LeadFormState, value: string) => {
    setForm({ ...form, [name]: value });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.phone_number) {
      setError("Phone number is required.");
      return;
    }

    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("leads")
      .insert({
        ...form,
        name: form.name || null,
        category: form.category || null,
        pipeline: form.pipeline || null,
        status: form.status || null,
        budget: form.budget || null,
        timeline: form.timeline || null,
        location: form.location || null,
        follow_up_date: form.follow_up_date || null,
        assigned_to: form.assigned_to || null,
        interested_property_id: form.interested_property_id || null,
        conversation_summary: form.conversation_summary || null,
        source: "manual",
      })
      .select("id")
      .single();

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push(`/leads/${data.id}`);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/leads" className="text-brown-light text-sm hover:text-brown mb-4 inline-block">
        ← Back to leads
      </Link>
      <h1 className="text-2xl font-bold text-ink mb-6">Add new lead</h1>
      <form onSubmit={handleCreate} className="bg-white/40 border border-brown-light/30 rounded-lg p-6 space-y-5">
        <LeadFormFields
          form={form}
          onChange={handleChange}
          onFieldChange={handleFieldChange}
          employees={employees}
          properties={properties}
        />
        {error && <p className="text-brick text-sm" role="alert">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2 rounded-md bg-brown text-cream font-medium hover:bg-ink transition-colors disabled:opacity-60"
        >
          {saving ? "Creating..." : "Create lead"}
        </button>
      </form>
    </div>
  );
}