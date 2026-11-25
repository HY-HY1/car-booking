import "server-only";
import { SERVICE_IMAGE_MAX_BYTES, SERVICE_IMAGE_TYPES, serviceImageUrl } from "@/lib/pricing-fields";
import type { createClient } from "@/lib/supabase/server";

// Images for a business's booking page (logo, cover, gallery, testimonials):
// the public service-images bucket, under the business's own brand folder,
// which only its owners can write to.

type Db = Awaited<ReturnType<typeof createClient>>;

export const IMAGE_BUCKET = "service-images";
// What a stored image URL starts with, so the file can be found and removed.
export const PUBLIC_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${IMAGE_BUCKET}/`;

// A file field that was filled in, or null.
export function imageFile(formData: FormData, name: string) {
  const f = formData.get(name);
  return f instanceof File && f.size > 0 ? f : null;
}

// A picked image's problem, if it can't be used.
export function imageProblem(file: File) {
  if (!SERVICE_IMAGE_TYPES[file.type]) return "Use a JPG, PNG or WebP image.";
  if (file.size > SERVICE_IMAGE_MAX_BYTES) return "Images can be up to 5 MB.";
  return null;
}

// An image into the business's brand folder; its public URL.
export async function uploadBrandImage(supabase: Db, tenantId: string, file: File) {
  const path = `${tenantId}/brand/${crypto.randomUUID()}.${SERVICE_IMAGE_TYPES[file.type]}`;
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, { contentType: file.type });
  if (error) throw error;
  return serviceImageUrl(path)!;
}

// Deletes images no longer used. Only our own uploads: anything else (an
// old link from elsewhere) is left alone. Never fails the save that called it.
export async function removeBrandImages(supabase: Db, urls: readonly string[]) {
  const paths = urls.filter((u) => u.startsWith(PUBLIC_PREFIX)).map((u) => u.slice(PUBLIC_PREFIX.length));
  if (!paths.length) return;
  const { error } = await supabase.storage.from(IMAGE_BUCKET).remove(paths);
  if (error) console.error("Couldn't remove old images", error);
}
