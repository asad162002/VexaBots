import { Select } from "@/components/ui/Select";

export type ConstructionFormState = {
  project_name: string;
  lead_id: string;
  location: string;
  size_sqft: string;
  budget_estimate_pkr: string;
  status: string;
  start_date: string;
  expected_end_date: string;
};

type Lead = { id: string; name: string | null; phone_number: string };

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

export function ConstructionFormFields({
  form,
  onChange,
  onFieldChange,
  leads,
}: {
  form: ConstructionFormState;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFieldChange: (name: keyof ConstructionFormState, value: string) => void;
  leads: Lead[];
}) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Field label="Project name *">
        <input
          name="project_name"
          value={form.project_name}
          onChange={onChange}
          required
          className="input"
        />
      </Field>

      <Field label="Linked lead">
        <Select
          value={form.lead_id}
          onChange={(v) => onFieldChange("lead_id", v)}
          placeholder="None linked"
          options={leads.map((l) => ({
            value: l.id,
            label: l.name ? `${l.name}, ${l.phone_number}` : l.phone_number,
          }))}
        />
      </Field>

      <Field label="Location">
        <input
          name="location"
          value={form.location}
          onChange={onChange}
          className="input"
        />
      </Field>

      <Field label="Size (sqft)">
        <input
          name="size_sqft"
          type="number"
          value={form.size_sqft}
          onChange={onChange}
          className="input"
        />
      </Field>

      <Field label="Budget estimate (PKR)">
        <input
          name="budget_estimate_pkr"
          type="number"
          value={form.budget_estimate_pkr}
          onChange={onChange}
          className="input"
        />
      </Field>

      <Field label="Status">
        <Select
          value={form.status}
          onChange={(v) => onFieldChange("status", v)}
          placeholder="Unselected"
          options={[
            { value: "planning", label: "Planning" },
            { value: "in_progress", label: "In progress" },
            { value: "completed", label: "Completed" },
            { value: "on_hold", label: "On hold" },
          ]}
        />
      </Field>

      <Field label="Start date">
        <input
          type="date"
          name="start_date"
          value={form.start_date}
          onChange={onChange}
          className="input"
        />
      </Field>

      <Field label="Expected end date">
        <input
          type="date"
          name="expected_end_date"
          value={form.expected_end_date}
          onChange={onChange}
          className="input"
        />
      </Field>
    </div>
  );
}