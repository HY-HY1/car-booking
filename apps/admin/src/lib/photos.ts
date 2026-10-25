import { createClient } from "@/lib/supabase/server";

// Customer photos for the dashboard. Files are private: each page view gets
// signed links that expire after an hour, made with the signed-in user's
// session, so Storage RLS checks they belong to this tenant.

export const PHOTO_BUCKET = "job-photos";

export type Photo = {
  id: string;
  url: string | null;
  created_at: string;
  width: number | null;
  height: number | null;
  booking: { id: string; starts_at: string } | null;
};

export async function listCustomerPhotos(tenantId: string, customerId: string): Promise<Photo[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("photos")
    .select("id, storage_path, created_at, width, height, booking:bookings(id, starts_at)")
    .eq("tenant_id", tenantId)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!data.length) return [];

  const signed = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(data.map((p) => p.storage_path), 3600);
  if (signed.error) throw signed.error;
  const urls = new Map(signed.data.map((s) => [s.path, s.signedUrl]));

  return data.map((p) => ({
    id: p.id,
    url: urls.get(p.storage_path) ?? null,
    created_at: p.created_at,
    width: p.width,
    height: p.height,
    booking: p.booking as unknown as Photo["booking"],
  }));
}

// Deletes files and rows. Owner-only by RLS on both photos and storage.
export async function deletePhotos(tenantId: string, filter: { customerId: string } | { id: string }) {
  const supabase = await createClient();
  let query = supabase.from("photos").select("id, storage_path").eq("tenant_id", tenantId);
  query = "id" in filter ? query.eq("id", filter.id) : query.eq("customer_id", filter.customerId);
  const { data, error } = await query;
  if (error) throw error;
  if (!data.length) return;

  const removed = await supabase.storage.from(PHOTO_BUCKET).remove(data.map((p) => p.storage_path));
  if (removed.error) throw removed.error;
  const rows = await supabase.from("photos").delete().eq("tenant_id", tenantId).in("id", data.map((p) => p.id));
  if (rows.error) throw rows.error;
}
