"use client";

import { useRef, useTransition } from "react";
import { Camera } from "lucide-react";
import { PhotoThumbs } from "@/components/dashboard/photo-thumbs";
import { buttonVariants } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import type { Photo } from "@/lib/photos";
import { cn } from "@/lib/utils";

const MAX_SIDE = 2000;

// Phone cameras take far bigger pictures than are needed here, and than the
// 5 MB a photo can be: scaled down first, so they're quick to send on site.
async function shrink(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    // A format the browser can't draw: send it as it is, and the server decides.
    return file;
  }
}

function Stage({
  title,
  stage,
  photos,
  upload,
  canAdd,
}: {
  title: string;
  stage: "before" | "after";
  photos: Photo[];
  upload: (stage: "before" | "after", formData: FormData) => Promise<{ error?: string; added?: number }>;
  canAdd: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function chosen(files: FileList | null) {
    if (!files?.length) return;
    const list = [...files];
    // One photo a request: Vercel refuses requests over 4.5 MB, which a
    // handful of photos together can pass even shrunk.
    startTransition(async () => {
      let added = 0;
      let error: string | undefined;
      for (const file of list) {
        const formData = new FormData();
        formData.append("photo", await shrink(file), "photo.jpg");
        const result = await upload(stage, formData);
        if (result.error) {
          error = result.error;
          break;
        }
        added += result.added ?? 0;
      }
      if (added) toast.success(`${added} ${added === 1 ? "photo" : "photos"} added`);
      if (error) toast.error(error);
      if (input.current) input.current.value = "";
    });
  }

  return (
    <div className="grid content-start gap-2">
      <h3 className="text-sm font-medium">{title}</h3>
      {photos.length > 0 ? <PhotoThumbs photos={photos} /> : <p className="text-sm text-muted-foreground">None yet.</p>}
      {canAdd && (
        <label className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-fit cursor-pointer border-border", pending && "pointer-events-none opacity-50")}>
          <Camera />
          {pending ? "Adding…" : "Add photos"}
          <input ref={input} type="file" accept="image/*" multiple className="sr-only" disabled={pending} onChange={(e) => chosen(e.target.files)} />
        </label>
      )}
    </div>
  );
}

// What the car looked like before the job and after it.
export function JobPhotos({
  before,
  after,
  upload,
  canAdd,
}: {
  before: Photo[];
  after: Photo[];
  upload: (stage: "before" | "after", formData: FormData) => Promise<{ error?: string; added?: number }>;
  canAdd: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Stage title="Before" stage="before" photos={before} upload={upload} canAdd={canAdd} />
      <Stage title="After" stage="after" photos={after} upload={upload} canAdd={canAdd} />
    </div>
  );
}
