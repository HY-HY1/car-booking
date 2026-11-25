"use client";

import { useId, useState } from "react";
import { ChevronsLeftRight } from "lucide-react";
import { cn } from "@/lib/cn";

// One before and after pair: the after photo, with the before laid over it
// and cut at the handle. Drag (or tap, or use the arrow keys) to move the
// handle and compare. A real range input does the work, so it's usable by
// keyboard and screen reader; it's invisible and covers the whole picture.
export function BeforeAfterSlider({ before, after, caption, className }: { before: string; after: string; caption?: string; className?: string }) {
  const [position, setPosition] = useState(50);
  const id = useId();
  return (
    <figure className={cn("grid gap-2.5", className)}>
      <div className="relative aspect-4/3 overflow-hidden rounded-2xl bg-neutral-200 shadow-sm ring-1 ring-black/5 select-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={after} alt={caption ? `After: ${caption}` : "After"} loading="lazy" draggable={false} className="absolute inset-0 size-full object-cover" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={before}
          alt={caption ? `Before: ${caption}` : "Before"}
          loading="lazy"
          draggable={false}
          className="absolute inset-0 size-full object-cover"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        />
        <span aria-hidden className="pointer-events-none absolute top-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold tracking-wide text-white uppercase backdrop-blur">
          Before
        </span>
        <span aria-hidden className="pointer-events-none absolute top-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold tracking-wide text-white uppercase backdrop-blur">
          After
        </span>
        {/* The handle. */}
        <span aria-hidden className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_8px_rgb(0_0_0/0.4)]" style={{ left: `${position}%` }}>
          <span className="absolute top-1/2 left-1/2 grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-neutral-900 shadow-lg">
            <ChevronsLeftRight className="size-5" />
          </span>
        </span>
        <label htmlFor={id} className="sr-only">
          {caption ? `Compare before and after: ${caption}` : "Compare before and after"}
        </label>
        <input
          id={id}
          type="range"
          min={0}
          max={100}
          step={1}
          value={position}
          onChange={(e) => setPosition(Number(e.target.value))}
          aria-valuetext={`${position}% before`}
          className="peer absolute inset-0 size-full cursor-ew-resize appearance-none opacity-0"
        />
        <span aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl ring-brand ring-inset peer-focus-visible:ring-2" />
      </div>
      {caption && <figcaption className="text-sm text-pretty text-neutral-600">{caption}</figcaption>}
    </figure>
  );
}
