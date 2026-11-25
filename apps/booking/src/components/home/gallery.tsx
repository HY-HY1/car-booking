"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, X } from "lucide-react";
import type { GalleryPhoto } from "@leadgen/core/branding/about";
import { cn } from "@/lib/cn";

// Photos of the business's work (Settings → Booking page → Photos of your
// work), in the order the owner set. The first few show on the page (the
// owner puts their best first); "See all" and tapping a photo open the
// viewer, with the arrow keys (or buttons) to go through the rest.
const SHOWN = 3;

export function GalleryGrid({ photos, businessName, titleId }: { photos: GalleryPhoto[]; businessName: string; titleId: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState<number | null>(null);

  const show = useCallback(
    (i: number) => {
      setOpen((i + photos.length) % photos.length);
      if (!dialog.current?.open) dialog.current?.showModal();
    },
    [photos.length],
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") show(open + 1);
      if (e.key === "ArrowLeft") show(open - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, show]);

  const current = open === null ? null : photos[open];
  const alt = (p: GalleryPhoto, i: number) => p.caption ?? `Work by ${businessName}, photo ${i + 1}`;

  const shown = photos.slice(0, SHOWN);
  const more = photos.length - shown.length;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <h2 id={titleId} className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Our work
        </h2>
        {more > 0 && (
          <button
            type="button"
            onClick={() => show(SHOWN)}
            className="inline-flex items-center gap-1.5 border-b border-current/30 pb-0.5 text-sm font-medium transition hover:border-current"
          >
            See all {photos.length} photos <ArrowRight className="size-4" aria-hidden />
          </button>
        )}
      </div>
      {/* On a phone the first photo spans the row and the next two share one. */}
      <ul className={cn("grid grid-cols-2 gap-3 sm:gap-4", shown.length === 3 && "sm:grid-cols-3")}>
        {shown.map((p, i) => (
          <li key={p.url} className={cn("grid content-start gap-2", shown.length !== 2 && i === 0 && "col-span-2 sm:col-span-1")}>
            <button
              type="button"
              onClick={() => show(i)}
              className="group block overflow-hidden rounded-xl bg-neutral-100 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
              aria-label={`See ${p.caption ? `"${p.caption}"` : `photo ${i + 1}`} bigger`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={alt(p, i)}
                loading="lazy"
                className="aspect-3/2 w-full object-cover transition duration-500 group-hover:scale-[1.03]"
              />
            </button>
            {p.caption && <p className="truncate text-sm text-neutral-600">{p.caption}</p>}
          </li>
        ))}
      </ul>

      <dialog
        ref={dialog}
        onClose={() => setOpen(null)}
        onClick={(e) => {
          // A click on the dark backdrop, not the photo, closes it.
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
        aria-label="Photo"
        className="m-auto max-h-none max-w-none bg-transparent p-0 text-white backdrop:bg-black/85"
      >
        {current && open !== null && (
          <figure className="grid max-h-[calc(100dvh-2rem)] w-[min(64rem,calc(100vw-2rem))] gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.url} alt={alt(current, open)} className="max-h-[calc(100dvh-7rem)] w-full rounded-lg object-contain" />
            <figcaption className="flex items-center justify-between gap-4 text-sm">
              <span className="min-w-0 text-pretty opacity-90">{current.caption}</span>
              <span className="flex shrink-0 items-center gap-1">
                {photos.length > 1 && (
                  <>
                    <span className="mr-2 tabular-nums opacity-70">
                      {open + 1} of {photos.length}
                    </span>
                    <LightboxButton label="Previous photo" onClick={() => show(open - 1)}>
                      <ChevronLeft className="size-5" />
                    </LightboxButton>
                    <LightboxButton label="Next photo" onClick={() => show(open + 1)}>
                      <ChevronRight className="size-5" />
                    </LightboxButton>
                  </>
                )}
                <LightboxButton label="Close" onClick={() => dialog.current?.close()}>
                  <X className="size-5" />
                </LightboxButton>
              </span>
            </figcaption>
          </figure>
        )}
      </dialog>
    </>
  );
}

function LightboxButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-10 place-items-center rounded-full bg-white/10 transition hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
    >
      {children}
    </button>
  );
}
