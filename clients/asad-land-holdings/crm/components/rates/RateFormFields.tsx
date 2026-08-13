import { Select } from "@/components/ui/Select";

export type RateFormState = {
  category: string;
  key: string;
  name: string;
  qty_per_sqft: string;
  unit: string;
  price_pkr: string;
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

export function RateFormFields({
  form,
  onChange,
  onFieldChange,
}: {
  form: RateFormState;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFieldChange: (name: keyof RateFormState, value: string) => void;
}) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Field label="Category *">
        <Select
          value={form.category}
          onChange={(v) => onFieldChange("category", v)}
          placeholder="Unselected"
          options={[
            { value: "grey_material", label: "Grey material" },
            { value: "finish_material", label: "Finish material" },
            { value: "labor", label: "Labor" },
            { value: "setting", label: "Setting" },
          ]}
        />
      </Field>

      <Field label="Key *">
        <input
          name="key"
          value={form.key}
          onChange={onChange}
          required
          placeholder="e.g. cement"
          className="input"
        />
      </Field>

      <Field label="Display name *">
        <input
          name="name"
          value={form.name}
          onChange={onChange}
          required
          placeholder="e.g. Cement"
          className="input"
        />
      </Field>

      <Field label="Unit">
        <input
          name="unit"
          value={form.unit}
          onChange={onChange}
          placeholder="e.g. bags, sqft, %"
          className="input"
        />
      </Field>

      <Field label="Quantity per sqft">
        <input
          name="qty_per_sqft"
          type="number"
          step="any"
          value={form.qty_per_sqft}
          onChange={onChange}
          placeholder="Leave blank if not applicable"
          className="input"
        />
      </Field>

      <Field label="Price (PKR) *">
        <input
          name="price_pkr"
          type="number"
          step="any"
          value={form.price_pkr}
          onChange={onChange}
          required
          className="input"
        />
      </Field>
    </div>
  );
}