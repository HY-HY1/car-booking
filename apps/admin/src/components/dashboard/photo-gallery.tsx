"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { formatDate } from "@leadgen/core/dates";
import type { Photo } from "@/lib/photos";
import { toast } from "@/components/ui/toast";
import { askToConfirm } from "@/components/ui/confirm-dialog";

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

  return (
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
                  onClick={async () => {
                    const confirmed = await askToConfirm({
                      title: "Delete this photo?",
                      description: "This can't be undone.",
                      confirmLabel: "Delete photo",
                      destructive: true,
                    });
                    if (!confirmed) return;
                    startTransition(async () => {
                      const { error } = await deleteAction(p.id);
                      if (error) toast.error(error);
                      else toast.success("Photo deleted");
                    });
                  }}
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          </li>
        ))}
    </ul>
  );
}
