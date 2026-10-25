"use client";

import { Camera, Loader2, RotateCcw, X } from "lucide-react";
import { removePhotoAction, uploadPhotoAction } from "./actions";

// Optional photos of the car. Each one is shrunk in the browser before it's
// sent: phone photos are 3–8 MB, this makes them a few hundred KB, so they
// upload quickly on mobile data. Redrawing on a canvas also drops the EXIF
// data, including the GPS location phones embed.

export const MAX_PHOTOS = 6;
const MAX_EDGE = 2000;

export type PhotoItem = {
  key: string;
  preview: string;
  status: "uploading" | "done" | "error";
  id?: string;
  error?: string;
  blob?: Blob;
  width?: number;
  height?: number;
};

type SetPhotos = (update: (photos: PhotoItem[]) => PhotoItem[]) => void;

async function shrink(file: File) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("Couldn't process photo");
  return { blob, width, height };
}

async function upload(item: PhotoItem, setPhotos: SetPhotos) {
  const update = (patch: Partial<PhotoItem>) =>
    setPhotos((photos) => photos.map((p) => (p.key === item.key ? { ...p, ...patch } : p)));
  update({ status: "uploading", error: undefined });

  const form = new FormData();
  form.set("photo", item.blob!, "photo.jpg");
  form.set("width", String(item.width ?? ""));
  form.set("height", String(item.height ?? ""));
  try {
    const result = await uploadPhotoAction(form);
    if (result.ok) update({ status: "done", id: result.id, blob: undefined });
    else update({ status: "error", error: result.message });
  } catch {
    update({ status: "error", error: "Upload failed" });
  }
}

export function PhotoPicker({
  tenantName,
  photos,
  setPhotos,
}: {
  tenantName: string;
  photos: PhotoItem[];
  setPhotos: SetPhotos;
}) {
  const room = MAX_PHOTOS - photos.length;

  const add = async (files: FileList | null) => {
    for (const file of Array.from(files ?? []).slice(0, room)) {
      const key = crypto.randomUUID();
      try {
        const { blob, width, height } = await shrink(file);
        const item: PhotoItem = { key, preview: URL.createObjectURL(blob), status: "uploading", blob, width, height };
        setPhotos((p) => [...p, item]);
        void upload(item, setPhotos);
      } catch {
        // Usually a format the browser can't open, such as HEIC on desktop.
        setPhotos((p) => [
          ...p,
          { key, preview: "", status: "error", error: "Can't open this photo. Try a JPEG." },
        ]);
      }
    }
  };

  const remove = (item: PhotoItem) => {
    setPhotos((p) => p.filter((x) => x.key !== item.key));
    if (item.preview) URL.revokeObjectURL(item.preview);
    if (item.id) void removePhotoAction(item.id);
  };

  return (
    <div className="grid gap-3">
      <p className="text-sm text-neutral-500">
        Optional, but it helps {tenantName} quote accurately: the outside from a front corner, the front and back
        seats, and anything that needs extra attention. Up to {MAX_PHOTOS}.
      </p>
      {photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <li key={p.key} className="relative aspect-square overflow-hidden rounded-xl border bg-neutral-100">
              {p.preview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.preview} alt="" className="size-full object-cover" />
              )}
              {p.status === "uploading" && (
                <div className="absolute inset-0 grid place-items-center bg-white/60">
                  <Loader2 className="size-6 animate-spin text-neutral-700" aria-label="Uploading" />
                </div>
              )}
              {p.status === "error" && (
                <div className="absolute inset-0 grid place-items-center gap-1 bg-red-50/90 p-2 text-center text-xs text-red-800">
                  <span>{p.error}</span>
                  {p.blob && (
                    <button
                      type="button"
                      onClick={() => void upload(p, setPhotos)}
                      className="inline-flex items-center gap-1 font-medium underline"
                    >
                      <RotateCcw className="size-3" /> Retry
                    </button>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={() => remove(p)}
                aria-label="Remove photo"
                className="absolute top-1 right-1 grid size-7 place-items-center rounded-full bg-black/60 text-white"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {room > 0 && (
        <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-full border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium hover:border-neutral-400 focus-within:ring-2 focus-within:ring-brand/30">
          <Camera className="size-4" />
          {photos.length ? "Add more photos" : "Add photos"}
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => {
              void add(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      )}
    </div>
  );
}
