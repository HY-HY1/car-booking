import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "./supabase/admin";

// Customer photos: stored in the private job-photos bucket under
// <tenant_id>/<photo_id>.<ext>, with a row in public.photos. A photo starts
// unattached (uploaded before we know who the customer is) and is attached
// to the customer, lead and booking as those are created. Unattached photos
// older than a day are abandoned uploads and get deleted.

export const PHOTO_BUCKET = "job-photos";
export const MAX_PHOTOS = 6;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PENDING_TTL_HOURS = 24;

const TYPES = {
  "image/jpeg": { ext: "jpg", magic: [0xff, 0xd8, 0xff] },
  "image/png": { ext: "png", magic: [0x89, 0x50, 0x4e, 0x47] },
  "image/webp": { ext: "webp", magic: [0x52, 0x49, 0x46, 0x46] }, // "RIFF", checked with "WEBP" below
} as const;
type PhotoType = keyof typeof TYPES;

// The type from the file's first bytes, not its name or the browser's claim.
export function sniffImageType(bytes: Uint8Array): PhotoType | null {
  for (const [type, { magic }] of Object.entries(TYPES) as [PhotoType, (typeof TYPES)[PhotoType]][]) {
    if (magic.every((b, i) => bytes[i] === b)) {
      if (type === "image/webp" && String.fromCharCode(...bytes.slice(8, 12)) !== "WEBP") continue;
      return type;
    }
  }
  return null;
}

export type PhotoResult =
  | { ok: true; id: string }
  | { ok: false; message: string };

export async function storePhoto(
  tenantId: string,
  file: unknown,
  dimensions?: { width?: number; height?: number },
): Promise<PhotoResult> {
  if (!(file instanceof Blob) || file.size === 0) return { ok: false, message: "That photo didn't come through. Try again." };
  if (file.size > MAX_PHOTO_BYTES) return { ok: false, message: "That photo is too big. Try a smaller one." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) return { ok: false, message: "That file isn't a photo we can use. Try a JPEG or PNG." };

  const db = createAdminClient();
  // Opportunistic tidy-up, so abandoned uploads go even without a cron job.
  await cleanupPendingPhotos(tenantId).catch((e) => console.error("Photo cleanup failed", e));

  const id = crypto.randomUUID();
  const path = `${tenantId}/${id}.${TYPES[type].ext}`;
  const upload = await db.storage.from(PHOTO_BUCKET).upload(path, bytes, { contentType: type, upsert: false });
  if (upload.error) throw upload.error;

  const valid = (n?: number) => (Number.isInteger(n) && n! > 0 && n! < 20000 ? n : null);
  const { error } = await db.from("photos").insert({
    id,
    tenant_id: tenantId,
    storage_path: path,
    content_type: type,
    size_bytes: bytes.length,
    width: valid(dimensions?.width),
    height: valid(dimensions?.height),
  });
  if (error) {
    await db.storage.from(PHOTO_BUCKET).remove([path]);
    throw error;
  }
  return { ok: true, id };
}

// Removes a photo the customer took back before submitting. Only unattached
// photos can go this way; once attached, they're the owner's to manage.
export async function removePendingPhoto(tenantId: string, id: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("photos")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .is("customer_id", null)
    .select("storage_path")
    .maybeSingle();
  if (error) throw error;
  if (data) await db.storage.from(PHOTO_BUCKET).remove([data.storage_path]);
}

// Links uploaded photos to the enquiry. Ids come from the browser, so only
// this tenant's photos that are unattached, or already this customer's,
// are touched.
export async function attachPhotos(
  db: SupabaseClient,
  tenantId: string,
  ids: string[],
  to: { customerId: string; leadId?: string; bookingId?: string },
) {
  if (!ids.length) return;
  const { error } = await db
    .from("photos")
    .update({
      customer_id: to.customerId,
      ...(to.leadId && { lead_id: to.leadId }),
      ...(to.bookingId && { booking_id: to.bookingId }),
      attached_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .in("id", ids.slice(0, MAX_PHOTOS))
    .or(`customer_id.is.null,customer_id.eq.${to.customerId}`);
  if (error) throw error;
}

// Deletes uploads that never became an enquiry. Runs on each upload for that
// tenant, and for every tenant from the daily jobs route.
export async function cleanupPendingPhotos(tenantId?: string, olderThanHours = PENDING_TTL_HOURS) {
  const db = createAdminClient();
  const cutoff = new Date(Date.now() - olderThanHours * 3_600_000).toISOString();
  let query = db.from("photos").select("id, storage_path").is("customer_id", null).lt("created_at", cutoff).limit(200);
  if (tenantId) query = query.eq("tenant_id", tenantId);
  const { data, error } = await query;
  if (error) throw error;
  if (!data.length) return 0;

  const removed = await db.storage.from(PHOTO_BUCKET).remove(data.map((p) => p.storage_path));
  if (removed.error) throw removed.error;
  const rows = await db.from("photos").delete().in("id", data.map((p) => p.id));
  if (rows.error) throw rows.error;
  return data.length;
}

// Deletes customer photos older than each business's photo retention setting
// (Settings → Privacy). Businesses without one keep photos as long as the
// customer's details. Runs from the daily jobs route.
export async function cleanupExpiredPhotos(limit = 500) {
  const db = createAdminClient();
  const { data: tenants, error } = await db
    .from("tenants")
    .select("id, photo_retention_days")
    .not("photo_retention_days", "is", null);
  if (error) throw error;

  let deleted = 0;
  for (const t of tenants) {
    if (deleted >= limit) break;
    const cutoff = new Date(Date.now() - t.photo_retention_days * 86_400_000).toISOString();
    const { data, error: listError } = await db
      .from("photos")
      .select("id, storage_path")
      .eq("tenant_id", t.id)
      .lt("created_at", cutoff)
      .limit(limit - deleted);
    if (listError) throw listError;
    if (!data.length) continue;

    const removed = await db.storage.from(PHOTO_BUCKET).remove(data.map((p) => p.storage_path));
    if (removed.error) throw removed.error;
    const rows = await db.from("photos").delete().in("id", data.map((p) => p.id));
    if (rows.error) throw rows.error;
    deleted += data.length;
  }
  return deleted;
}
