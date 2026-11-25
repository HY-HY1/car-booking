"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Phone } from "lucide-react";
import { cn } from "@/lib/cn";

// Phones only: once the top of the home page (the heading and the booking
// card, given by id in `watch`) has scrolled out of view, a bar slides up
// from the bottom with the starting price and the way to book, so it's
// always a tap away on a long page. Hidden again when they scroll back up.
export function BookBar({
  watch,
  href,
  priceFrom,
  terms,
  phone,
}: {
  watch: string[];
  href: string;
  // "£45", the cheapest service's starting price.
  priceFrom: string | null;
  // The deposit and cancellation line, when it's shown.
  terms: string | null;
  // The number to ring, when the business shows it.
  phone: string | null;
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const targets = watch.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => Boolean(el));
    if (!targets.length) return;
    const visible = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) visible.add(e.target);
        else visible.delete(e.target);
      }
      setShown(visible.size === 0);
    });
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, [watch]);

  return (
    <div
      inert={!shown}
      className={cn(
        "fixed inset-x-0 bottom-0 z-20 border-t bg-surface/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur transition-transform duration-300 sm:hidden",
        shown ? "translate-y-0" : "translate-y-full",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          {priceFrom && (
            <p className="text-sm leading-tight">
              <span className="text-neutral-500">From </span>
              <span className="text-lg font-semibold tabular-nums">{priceFrom}</span>
            </p>
          )}
          {terms && <p className="truncate text-xs text-neutral-500">{terms}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {phone && (
            <a
              href={`tel:${phone}`}
              aria-label="Call"
              className="grid size-11 place-items-center rounded-full border border-neutral-300 text-neutral-800 transition hover:bg-neutral-100"
            >
              <Phone className="size-4" aria-hidden />
            </a>
          )}
          <Link href={href} className="inline-flex h-11 items-center rounded-full bg-accent px-6 font-medium text-accent-fg shadow-sm">
            Book now
          </Link>
        </div>
      </div>
    </div>
  );
}
