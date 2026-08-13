import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import PropertyDetailForm from "./PropertyDetailForm";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: property, error } = await supabase
    .from("properties")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error || !property) {
    notFound();
  }

  const { data: media } = await supabase
    .from("property_media")
    .select("id, media_type, url, created_at")
    .eq("property_id", id)
    .order("created_at", { ascending: true });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: string = "employee";
  if (user) {
    const { data: employee } = await supabase
      .from("employees")
      .select("role")
      .eq("id", user.id)
      .single();
    role = employee?.role ?? "employee";
  }

  return (
    <div className="min-h-screen bg-cream p-4 md:p-8">
      <PropertyDetailForm
        property={property}
        media={media ?? []}
        role={role}
      />
    </div>
  );
}