import { Select } from "@/components/ui/Select";

type Employee = { id: string; name: string };
type Property = { id: string; location: string; property_type: string };

export type LeadFormState = {
  name: string;
  phone_number: string;
  category: string;
  pipeline: string;
  status: string;
  budget: string;
  timeline: string;
  location: string;
  follow_up_date: string;
  assigned_to: string;
  interested_property_id: string;
  conversation_summary: string;
};

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

export function LeadFormFields({
  form,
  onChange,
  onFieldChange,
  employees,
  properties,
  phoneRequired = true,
}: {
  form: LeadFormState;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
  onFieldChange: (name: keyof LeadFormState, value: string) => void;
  employees: Employee[];
  properties: Property[];
  phoneRequired?: boolean;
}) {
  return (
    <>
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Name">
          <input name="name" value={form.name} onChange={onChange} className="input" />
        </Field>

        <Field label={phoneRequired ? "Phone *" : "Phone"}>
          <input
            name="phone_number"
            value={form.phone_number}
            onChange={onChange}
            required={phoneRequired}
            placeholder="+92..."
            className="input"
          />
        </Field>

        <Field label="Category">
          <Select
            value={form.category}
            onChange={(v) => onFieldChange("category", v)}
            placeholder="Unselected"
            options={[
              { value: "construction", label: "Construction" },
              { value: "real_estate", label: "Real Estate" },
              { value: "consulting", label: "Consulting" },
            ]}
          />
        </Field>

        <Field label="Pipeline stage">
          <Select
            value={form.pipeline}
            onChange={(v) => onFieldChange("pipeline", v)}
            placeholder="Unselected"
            options={[
              { value: "new", label: "New" },
              { value: "ongoing", label: "Ongoing" },
              { value: "completed", label: "Completed" },
            ]}
          />
        </Field>

        <Field label="Status">
          <Select
            value={form.status}
            onChange={(v) => onFieldChange("status", v)}
            placeholder="Unselected"
            options={[
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
          />
        </Field>

        <Field label="Budget">
          <input
            name="budget"
            value={form.budget}
            onChange={onChange}
            placeholder="e.g. 5,000,000 PKR"
            className="input"
          />
        </Field>

        <Field label="Timeline">
          <input
            name="timeline"
            value={form.timeline}
            onChange={onChange}
            placeholder="e.g. 3-6 months"
            className="input"
          />
        </Field>

        <Field label="Location">
          <input name="location" value={form.location} onChange={onChange} className="input" />
        </Field>

      

        <Field label="Assigned to">
          <Select
            value={form.assigned_to}
            onChange={(v) => onFieldChange("assigned_to", v)}
            placeholder="Unassigned"
            options={employees.map((emp) => ({ value: emp.id, label: emp.name }))}
          />
        </Field>

        <Field label="Interested property">
          <Select
            value={form.interested_property_id}
            onChange={(v) => onFieldChange("interested_property_id", v)}
            placeholder="None linked"
           options={properties.map((p) => ({
              value: p.id,
              label: `${p.location}, ${p.property_type}`,
            }))}
          />
        </Field>
      </div>

      <Field label="Conversation summary">
        <textarea
          name="conversation_summary"
          value={form.conversation_summary}
          onChange={onChange}
          rows={4}
          className="input resize-none"
        />
      </Field>
    </>
  );
}