"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { RateFormFields, RateFormState } from "@/components/rates/RateFormFields";

type Rate = {
  id: string;
  category: string;
  key: string;
  name: string;
  qty_per_sqft: number | null;
  unit: string | null;
  price_pkr: number;
};

const EMPTY_FORM: RateFormState = {
  category: "",
  key: "",
  name: "",
  qty_per_sqft: "",
  unit: "",
  price_pkr: "",
};

export default function RatesTable({
  initialRates,
  categoryLabels,
}: {
  initialRates: Rate[];
  categoryLabels: Record<string, string>;
}) {
  const router = useRouter();
  const [rates, setRates] = useState<Rate[]>(initialRates);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<RateFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState<RateFormState>(EMPTY_FORM);
  const [addError, setAddError] = useState<string | null>(null);

  const startEdit = (rate: Rate) => {
    setEditingId(rate.id);
    setEditForm({
      category: rate.category,
      key: rate.key,
      name: rate.name,
      qty_per_sqft: rate.qty_per_sqft?.toString() ?? "",
      unit: rate.unit ?? "",
      price_pkr: rate.price_pkr.toString(),
    });
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setError(null);
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const handleEditFieldChange = (name: keyof RateFormState, value: string) => {
    setEditForm({ ...editForm, [name]: value });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase
      .from("construction_rates")
      .update({
        category: editForm.category,
        key: editForm.key,
        name: editForm.name,
        qty_per_sqft: editForm.qty_per_sqft ? Number(editForm.qty_per_sqft) : null,
        unit: editForm.unit || null,
        price_pkr: Number(editForm.price_pkr),
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingId);

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setEditingId(null);
    router.refresh();
    const supabase2 = createClient();
    const { data } = await supabase2
      .from("construction_rates")
      .select("id, category, key, name, qty_per_sqft, unit, price_pkr")
      .order("category")
      .order("name");
    if (data) setRates(data);
  };

  const deleteRate = async (id: string) => {
    if (!confirm("Delete this rate? This cannot be undone.")) return;

    const supabase = createClient();
    const { error } = await supabase.from("construction_rates").delete().eq("id", id);

    if (error) {
      setError(error.message);
      return;
    }

    setRates((prev) => prev.filter((r) => r.id !== id));
  };

  const handleAddChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAddForm({ ...addForm, [e.target.name]: e.target.value });
  };

  const handleAddFieldChange = (name: keyof RateFormState, value: string) => {
    setAddForm({ ...addForm, [name]: value });
  };

  const handleAdd = async () => {
    if (!addForm.category || !addForm.key.trim() || !addForm.name.trim() || !addForm.price_pkr) {
      setAddError("Category, key, name, and price are required.");
      return;
    }

    setSaving(true);
    setAddError(null);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("construction_rates")
      .insert({
        category: addForm.category,
        key: addForm.key.trim(),
        name: addForm.name.trim(),
        qty_per_sqft: addForm.qty_per_sqft ? Number(addForm.qty_per_sqft) : null,
        unit: addForm.unit || null,
        price_pkr: Number(addForm.price_pkr),
      })
      .select("id, category, key, name, qty_per_sqft, unit, price_pkr")
      .single();

    setSaving(false);

    if (error) {
      setAddError(error.message);
      return;
    }

    setRates((prev) => [...prev, data as Rate]);
    setAddForm(EMPTY_FORM);
    setAdding(false);
  };

  const grouped = rates.reduce<Record<string, Rate[]>>((acc, rate) => {
    (acc[rate.category] ??= []).push(rate);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <h2 className="text-ink font-medium mb-3">
            {categoryLabels[category] ?? category}
          </h2>
          <div className="bg-white/40 rounded-lg border border-brown-light/30 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-brown/5 text-left text-brown-light">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Key</th>
                  <th className="px-4 py-2 font-medium">Qty/sqft</th>
                  <th className="px-4 py-2 font-medium">Unit</th>
                  <th className="px-4 py-2 font-medium">Price (PKR)</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((rate) =>
                  editingId === rate.id ? (
                    <tr key={rate.id} className="border-t border-brown-light/20 bg-brown/5">
                      <td colSpan={6} className="px-4 py-3">
                        <RateFormFields
                          form={editForm}
                          onChange={handleEditChange}
                          onFieldChange={handleEditFieldChange}
                        />
                        {error && <p className="text-brick text-sm mt-2">{error}</p>}
                        <div className="flex items-center gap-2 mt-3">
                          <button
                            type="button"
                            onClick={saveEdit}
                            disabled={saving}
                            className="px-3 py-1.5 rounded-md bg-brown text-cream text-sm font-medium disabled:opacity-60"
                          >
                            {saving ? "Saving..." : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="px-3 py-1.5 rounded-md text-brown-light text-sm hover:text-ink"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={rate.id} className="border-t border-brown-light/20 hover:bg-brown/5">
                      <td className="px-4 py-2 text-ink">{rate.name}</td>
                      <td className="px-4 py-2 text-brown-light">{rate.key}</td>
                      <td className="px-4 py-2 text-brown-light">{rate.qty_per_sqft ?? "—"}</td>
                      <td className="px-4 py-2 text-brown-light">{rate.unit ?? "—"}</td>
                      <td className="px-4 py-2 text-brown-light">
                        {rate.price_pkr.toLocaleString()}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => startEdit(rate)}
                            className="text-brown text-sm hover:text-ink"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteRate(rate.id)}
                            className="text-brick text-sm hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div>
        {!adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="px-4 py-2 rounded-md bg-brown text-cream text-sm font-medium"
          >
            + Add rate
          </button>
        ) : (
          <div className="bg-white/40 border border-brown-light/30 rounded-lg p-4">
            <RateFormFields
              form={addForm}
              onChange={handleAddChange}
              onFieldChange={handleAddFieldChange}
            />
            {addError && <p className="text-brick text-sm mt-2">{addError}</p>}
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={handleAdd}
                disabled={saving}
                className="px-3 py-1.5 rounded-md bg-brown text-cream text-sm font-medium disabled:opacity-60"
              >
                {saving ? "Adding..." : "Add rate"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setAddForm(EMPTY_FORM);
                  setAddError(null);
                }}
                className="px-3 py-1.5 rounded-md text-brown-light text-sm hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}