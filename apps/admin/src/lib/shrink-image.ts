// Shrinks an image in the browser before it's uploaded. Uploads go through a
// server action, and the host caps a request at about 4.5 MB (Vercel), so a
// phone photo or a print-size logo sent as-is fails before it reaches us.
// Redrawn as WebP, which keeps a logo's transparent background (browsers that
// can't write WebP give PNG); redrawing also drops the photo's EXIF data,
// including any GPS location. Client-only.

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Anything still bigger than this after shrinking isn't sent.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export async function shrinkImage(file: File, maxEdge: number): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
  // Keep the original if redrawing didn't help (a small, already-compressed file).
  if (!blob || (blob.size >= file.size && scale === 1)) return file;
  const ext = blob.type === "image/webp" ? "webp" : "png";
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "image"}.${ext}`, { type: blob.type });
}
