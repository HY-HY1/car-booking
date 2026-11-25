"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Quote, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Stars } from "./stars";

// The review cards on the home page, and the bigger view a card opens: the
// whole review, its photos in a strip that swipes (or steps with the arrows
// and arrow keys), and buttons through to the other reviews.

export type ReviewCardData = {
  key: string;
  kind: "google" | "testimonial";
  text: string;
  name: string;
  // Under the name: "Google review · May 2026", "Sent by text".
  detail: string | null;
  // Google reviews only: testimonials have no stars, as nobody rated them.
  rating?: number;
  avatarUrl?: string;
  photos: { url: string; label?: string }[];
};

const THUMBS = 3;

export function ReviewCards({ cards }: { cards: ReviewCardData[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState<number | null>(null);

  const show = (i: number) => {
    setOpen((i + cards.length) % cards.length);
    if (!dialog.current?.open) dialog.current?.showModal();
  };

  // The page behind stays put while the dialog is open.
  useEffect(() => {
    if (open === null) return;
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = before;
    };
  }, [open]);

  const current = open === null ? null : cards[open];

  return (
    <>
      <ul className={cn("grid gap-5", cards.length > 1 && "md:grid-cols-2", cards.length > 2 && "lg:grid-cols-3")}>
        {cards.map((c, i) => (
          <li key={c.key} className="relative flex flex-col gap-4 rounded-2xl bg-surface p-6 shadow-sm ring-1 ring-black/5 transition hover:shadow-md sm:p-7">
            <div className="flex min-h-8 items-center">
              <CardTop card={c} />
            </div>
            <blockquote className="line-clamp-6 text-[1.0625rem] leading-relaxed text-pretty whitespace-pre-line text-neutral-800">{c.text}</blockquote>
            {c.photos.length > 0 && (
              <div className="flex gap-2" aria-hidden>
                {c.photos.slice(0, THUMBS).map((p, n) => (
                  <span key={p.url} className="relative h-14 w-20 overflow-hidden rounded-lg bg-neutral-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt="" loading="lazy" className="size-full object-cover" />
                    {n === THUMBS - 1 && c.photos.length > THUMBS && (
                      <span className="absolute inset-0 grid place-items-center bg-black/50 text-sm font-semibold text-white">
                        +{c.photos.length - THUMBS}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            )}
            <CardFooter card={c} />
            {/* The whole card opens the bigger view. */}
            <button
              type="button"
              onClick={() => show(i)}
              className="absolute inset-0 rounded-2xl focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
              aria-label={`Read ${c.name}'s review in full${c.photos.length ? `, with ${c.photos.length} photo${c.photos.length === 1 ? "" : "s"}` : ""}`}
            />
          </li>
        ))}
      </ul>

      <dialog
        ref={dialog}
        onClose={() => setOpen(null)}
        onClick={(e) => {
          // A click on the backdrop, outside the panel, closes it.
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
        aria-label={current ? `${current.name}'s review` : "Review"}
        className="m-auto max-h-none w-[min(44rem,calc(100vw-1.5rem))] max-w-none overflow-visible bg-transparent p-0 backdrop:bg-black/70"
      >
        {current && open !== null && (
          <div className="grid max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-2xl bg-surface text-(--ink) shadow-2xl">
            <div className="sticky top-0 z-10 flex justify-end p-2">
              <button
                type="button"
                onClick={() => dialog.current?.close()}
                aria-label="Close"
                className="grid size-10 place-items-center rounded-full bg-surface/90 text-neutral-700 shadow-sm ring-1 ring-black/5 backdrop-blur transition hover:text-neutral-950"
              >
                <X className="size-5" />
              </button>
            </div>
            {current.photos.length > 0 && <PhotoStrip key={current.key} photos={current.photos} name={current.name} />}
            <div className="grid gap-5 p-6 sm:p-8">
              <CardTop card={current} />
              <blockquote className="text-lg leading-relaxed text-pretty whitespace-pre-line text-neutral-800">{current.text}</blockquote>
              <CardFooter card={current} />
            </div>
            {cards.length > 1 && (
              <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm sm:px-6">
                <button
                  type="button"
                  onClick={() => show(open - 1)}
                  className="inline-flex h-10 items-center gap-1 rounded-full px-3 font-medium text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-950"
                >
                  <ChevronLeft className="size-4" aria-hidden /> Previous
                </button>
                <span className="text-neutral-500 tabular-nums">
                  {open + 1} of {cards.length}
                </span>
                <button
                  type="button"
                  onClick={() => show(open + 1)}
                  className="inline-flex h-10 items-center gap-1 rounded-full px-3 font-medium text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-950"
                >
                  Next <ChevronRight className="size-4" aria-hidden />
                </button>
              </div>
            )}
          </div>
        )}
      </dialog>
    </>
  );
}

function CardTop({ card }: { card: ReviewCardData }) {
  return card.rating !== undefined ? (
    <>
      <Stars rating={card.rating} className="text-lg text-amber-400" />
      <span className="sr-only">{card.rating} out of 5 stars</span>
    </>
  ) : (
    <Quote aria-hidden className="size-8 fill-current text-accent opacity-80" strokeWidth={0} />
  );
}

function CardFooter({ card }: { card: ReviewCardData }) {
  return (
    <footer className="mt-auto flex items-center gap-3 border-t pt-4">
      {card.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.avatarUrl} alt="" loading="lazy" className="size-11 shrink-0 rounded-full bg-wash object-cover" />
      ) : (
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-wash font-heading font-semibold text-brand">
          {card.name.trim().charAt(0).toUpperCase()}
        </span>
      )}
      <span className="grid min-h-11 min-w-0 content-center gap-0.5">
        <span className="truncate font-semibold text-neutral-900">{card.name}</span>
        {card.detail && <span className="truncate text-xs text-neutral-500">{card.detail}</span>}
      </span>
    </footer>
  );
}

// The review's photos, side by side in a strip that swipes on a phone and
// snaps to each one; the arrows (and arrow keys) step through them.
function PhotoStrip({ photos, name }: { photos: ReviewCardData["photos"]; name: string }) {
  const strip = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const go = (i: number) => {
    const el = strip.current;
    if (!el) return;
    const to = Math.max(0, Math.min(photos.length - 1, i));
    el.scrollTo({ left: to * el.clientWidth, behavior: "smooth" });
  };

  useEffect(() => {
    if (photos.length < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(index + 1);
      if (e.key === "ArrowLeft") go(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="relative -mt-14 bg-neutral-950">
      <div
        ref={strip}
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label={`Photos from ${name}'s review`}
      >
        {photos.map((p, i) => (
          <figure key={p.url} className="relative w-full shrink-0 snap-center" aria-label={`Photo ${i + 1} of ${photos.length}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.label ?? `Photo ${i + 1} from ${name}'s review`} className="aspect-4/3 w-full object-contain" />
            {p.label && (
              <figcaption className="absolute bottom-3 left-3 max-w-[70%] truncate rounded-full bg-black/65 px-3 py-1 text-sm font-medium text-white backdrop-blur">
                {p.label}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
      {photos.length > 1 && (
        <>
          <StripButton side="left" disabled={index === 0} onClick={() => go(index - 1)} />
          <StripButton side="right" disabled={index === photos.length - 1} onClick={() => go(index + 1)} />
          <div className="absolute right-3 bottom-3.5 flex gap-1.5 rounded-full bg-black/45 px-2 py-1.5 backdrop-blur" aria-hidden>
            {photos.map((p, i) => (
              <span key={p.url} className={cn("size-1.5 rounded-full transition", i === index ? "bg-white" : "bg-white/45")} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StripButton({ side, disabled, onClick }: { side: "left" | "right"; disabled: boolean; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={side === "left" ? "Previous photo" : "Next photo"}
      className={cn(
        "absolute top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-neutral-900 shadow transition hover:bg-white disabled:opacity-0",
        side === "left" ? "left-3" : "right-3",
      )}
    >
      <Icon className="size-5" />
    </button>
  );
}
