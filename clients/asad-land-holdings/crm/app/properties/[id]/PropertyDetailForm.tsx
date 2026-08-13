"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { StatusBadge } from "@/components/ui/StatusBadge";
import Link from "next/link";
import {
  PropertyFormFields,
  PropertyFormState,
  Field,
} from "@/components/properties/PropertyFormFields";

type MediaItem = {
  id: string;
  media_type: string;
  url: string;
  created_at: string;
};

const CAN_EDIT_ROLES = ["admin", "super_admin"];

export default function PropertyDetailForm({
  property,
  media,
  role,
}: {
  property: any;
  media: MediaItem[];
  role: string;
}) {
  const router = useRouter();
  const canEdit = CAN_EDIT_ROLES.includes(role);

  const [form, setForm] = useState<PropertyFormState>({
    location: property.location ?? "",
    property_type: property.property_type ?? "",
    size: property.size ?? "",
    price_pkr: property.price_pkr ?? "",
    status: property.status ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [mediaItems, setMediaItems] = useState<MediaItem[]>(media);
  const [newMediaUrl, setNewMediaUrl] = useState("");
  const [addingMedia, setAddingMedia] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setSaved(false);
  };

  const handleFieldChange = (name: keyof PropertyFormState, value: string) => {
    setForm({ ...form, [name]: value });
    setSaved(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    if (!form.location.trim()) {
      setError("Location is required.");
      return;
    }

    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase
      .from("properties")
      .update({
        location: form.location.trim(),
        property_type: form.property_type || null,
        size: form.size || null,
        price_pkr: form.price_pkr || null,
        status: form.status || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", property.id);

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSaved(true);
    router.refresh();
  };

  const handleDelete = async () => {
    if (!canEdit) return;

    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("properties")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", property.id);

    setDeleting(false);

    if (error) {
      setError(error.message);
      setShowDeleteConfirm(false);
      return;
    }

    router.push("/properties");
    router.refresh();
  };

  const handleAddMedia = async () => {
    if (!canEdit) return;

    const url = newMediaUrl.trim();
    if (!url) {
      setMediaError("Enter an image URL.");
      return;
    }

    setAddingMedia(true);
    setMediaError(null);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("property_media")
      .insert({
        property_id: property.id,
        media_type: "image",
        url,
      })
      .select("id, media_type, url, created_at")
      .single();

    setAddingMedia(false);

    if (error) {
      setMediaError(error.message);
      return;
    }

    setMediaItems((prev) => [...prev, data as MediaItem]);
    setNewMediaUrl("");
  };

  const handleRemoveMedia = async (mediaId: string) => {
    if (!canEdit) return;

    const supabase = createClient();
    const { error } = await supabase
      .from("property_media")
      .delete()
      .eq("id", mediaId);

    if (error) {
      setMediaError(error.message);
      return;
    }

    setMediaItems((prev) => prev.filter((m) => m.id !== mediaId));
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href="/properties"
        className="text-brown-light text-sm hover:text-brown mb-4 inline-block"
      >
        ← Back to properties
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-ink">{property.location}</h1>
        <div className="flex items-center gap-2">
          <StatusBadge value={form.status} />
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="ml-3 text-brick text-sm hover:underline"
            >
              Delete property
            </button>
          )}
        </div>
      </div>

      {!canEdit && (
        <p className="text-brown-light text-sm mb-4">
          View only — contact an admin to make changes to this property.
        </p>
      )}

      {showDeleteConfirm && canEdit && (
        <div className="bg-brick/10 border border-brick/30 rounded-lg p-4 mb-6">
          <p className="text-ink text-sm mb-3">
            Delete this property? It will be hidden from the properties list
            but not permanently removed.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-3 py-1.5 rounded-md bg-brick text-cream text-sm font-medium disabled:opacity-60"
            >
              {deleting ? "Deleting..." : "Yes, delete"}
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="px-3 py-1.5 rounded-md text-brown-light text-sm hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {canEdit ? (
        <form
          onSubmit={handleSave}
          className="bg-white/40 border border-brown-light/30 rounded-lg p-6 space-y-5"
        >
          <PropertyFormFields
            form={form}
            onChange={handleChange}
            onFieldChange={handleFieldChange}
          />
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
      ) : (
        <div className="bg-white/40 border border-brown-light/30 rounded-lg p-6 grid md:grid-cols-2 gap-4">
          <Field label="Location">
            <p className="text-ink">{property.location}</p>
          </Field>
          <Field label="Property type">
            <StatusBadge value={property.property_type} variant="category" />
          </Field>
          <Field label="Size">
            <p className="text-ink">{property.size || "—"}</p>
          </Field>
          <Field label="Price (PKR)">
            <p className="text-ink">
              {property.price_pkr
                ? Number(property.price_pkr).toLocaleString()
                : "—"}
            </p>
          </Field>
          <Field label="Status">
            <StatusBadge value={property.status} />
          </Field>
        </div>
      )}

      <div className="bg-white/40 border border-brown-light/30 rounded-lg p-6 mt-6">
        <h2 className="text-ink font-medium mb-4">Photos</h2>

        {mediaItems.length === 0 && (
          <p className="text-brown-light text-sm mb-4">No photos added yet.</p>
        )}

        {mediaItems.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            {mediaItems.map((item) => (
              <div key={item.id} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt={`${property.location} photo`}
                  className="w-full aspect-square object-cover rounded-md border border-brown-light/30"
                />
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => handleRemoveMedia(item.id)}
                    aria-label="Remove photo"
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-ink/70 text-cream text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {canEdit && (
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={newMediaUrl}
              onChange={(e) => setNewMediaUrl(e.target.value)}
              placeholder="Image URL (optional)"
              className="input flex-1"
              onKeyDown={(e) =>
                e.key === "Enter" && (e.preventDefault(), handleAddMedia())
              }
            />
            <button
              type="button"
              onClick={handleAddMedia}
              disabled={addingMedia}
              className="px-4 py-2 rounded-md bg-brown text-cream text-sm font-medium disabled:opacity-60 whitespace-nowrap"
            >
              {addingMedia ? "Adding..." : "Add photo"}
            </button>
          </div>
        )}
        {mediaError && (
          <p className="text-brick text-sm mt-2" role="alert">
            {mediaError}
          </p>
        )}
      </div>
    </div>
  );
}