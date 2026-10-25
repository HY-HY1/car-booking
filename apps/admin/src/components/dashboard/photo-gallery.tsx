"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { formatDate } from "@leadgen/core/customer-fields";
import type { Photo } from "@/lib/photos";

export function PhotoGallery({
  photos,
  canDelete,
  deleteAction,
}: {
  photos: Photo[];
  canDelete: boolean;
  deleteAction: (id: string) => Promise<{ error?: string }>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  return (
    <div className="grid gap-2">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((p) => (
          <li key={p.id} className="group relative overflow-hidden rounded-xl border bg-muted">
            {p.url ? (
              <a href={p.url} target="_blank" rel="noreferrer" className="block aspect-[4/3]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" loading="lazy" className="size-full object-cover" />
              </a>
            ) : (
              <div className="grid aspect-[4/3] place-items-center text-xs text-muted-foreground">Unavailable</div>
            )}
            <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs text-muted-foreground">
              <span>
                {formatDate(p.created_at)}
                {p.booking && " · booked"}
              </span>
              {canDelete && (
                <button
                  type="button"
                  disabled={pending}
                  aria-label="Delete photo"
                  className="rounded p-1 hover:bg-background hover:text-destructive"
                  onClick={() => {
                    if (!confirm("Delete this photo? This can't be undone.")) return;
                    startTransition(async () => setError((await deleteAction(p.id)).error));
                  }}
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
