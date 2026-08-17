export type ClientFormState = {
  name: string;
  phone: string;
  email: string;
  address: string;
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

export function ClientFormFields({
  form,
  onChange,
}: {
  form: ClientFormState;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Field label="Name *">
        <input
          name="name"
          value={form.name}
          onChange={onChange}
          required
          className="input"
        />
      </Field>

      <Field label="Phone">
        <input
          name="phone"
          value={form.phone}
          onChange={onChange}
          placeholder="+92..."
          className="input"
        />
      </Field>

      <Field label="Email">
        <input
          name="email"
          type="email"
          value={form.email}
          onChange={onChange}
          className="input"
        />
      </Field>

      <Field label="Address">
        <input
          name="address"
          value={form.address}
          onChange={onChange}
          className="input"
        />
      </Field>
    </div>
  );
}