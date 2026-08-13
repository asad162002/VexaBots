import { Select } from "@/components/ui/Select";

export type PropertyFormState = {
  location: string;
  property_type: string;
  size: string;
  price_pkr: string;
  status: string;
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

export function PropertyFormFields({
  form,
  onChange,
  onFieldChange,
}: {
  form: PropertyFormState;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFieldChange: (name: keyof PropertyFormState, value: string) => void;
}) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Field label="Location *">
        <input
          name="location"
          value={form.location}
          onChange={onChange}
          required
          className="input"
        />
      </Field>

      <Field label="Property type">
        <Select
          value={form.property_type}
          onChange={(v) => onFieldChange("property_type", v)}
          placeholder="Unselected"
          options={[
            { value: "plot", label: "Plot" },
            { value: "house", label: "House" },
            { value: "commercial", label: "Commercial" },
          ]}
        />
      </Field>

      <Field label="Size">
        <input
          name="size"
          value={form.size}
          onChange={onChange}
          placeholder="e.g. 10 Marla"
          className="input"
        />
      </Field>

      <Field label="Price (PKR)">
        <input
          name="price_pkr"
          type="number"
          value={form.price_pkr}
          onChange={onChange}
          placeholder="e.g. 15000000"
          className="input"
        />
      </Field>

      <Field label="Status">
        <Select
          value={form.status}
          onChange={(v) => onFieldChange("status", v)}
          placeholder="Unselected"
          options={[
            { value: "available", label: "Available" },
            { value: "sold", label: "Sold" },
            { value: "reserved", label: "Reserved" },
          ]}
        />
      </Field>
    </div>
  );
}