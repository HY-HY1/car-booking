import Link from "next/link";
import { safeEmbedUrl, type Demo } from "@/lib/demos";
import { SHOW_PLACEHOLDERS } from "@/lib/proof";
import { PlaceholderTag } from "./ui";

// A 16:9 slot for a demo video (lib/demos.ts). With no video yet it offers a
// live demo instead, so the page never shows an empty player.
export function DemoFrame({ demo, size = "large" }: { demo: Demo; size?: "large" | "small" }) {
  const src = safeEmbedUrl(demo.embedUrl);
  const big = size === "large";

  return (
    <figure>
      <div className="relative aspect-video overflow-hidden border-2 border-(--paper) bg-[#0a0a0a]">
        {src ? (
          <iframe
            src={src}
            title={demo.title}
            loading="lazy"
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 size-full"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col justify-between bg-[radial-gradient(circle_at_30%_20%,#262a26,#0a0a0a_70%)] p-4 sm:p-6">
            <div className="lp-data flex items-center justify-between text-[11px] tracking-[0.14em] text-(--mist) uppercase">
              <span>
                Demo · {demo.length}
                {SHOW_PLACEHOLDERS && <PlaceholderTag />}
              </span>
              <span aria-hidden className="flex gap-1.5">
                <span className="size-2 rounded-full bg-(--rule-dark)" />
                <span className="size-2 rounded-full bg-(--rule-dark)" />
                <span className="size-2 rounded-full bg-(--rule-dark)" />
              </span>
            </div>

            <div className="flex items-end justify-between gap-4">
              <p className={`lp-display max-w-md text-(--paper) ${big ? "text-[clamp(1.75rem,4vw,3.25rem)]" : "text-2xl sm:text-3xl"}`}>{demo.title}</p>
              <span aria-hidden className={`grid shrink-0 place-items-center rounded-full bg-(--hi) text-(--ink) ${big ? "size-16 sm:size-20" : "size-12"}`}>
                <svg viewBox="0 0 24 24" className={big ? "ml-1 size-7 sm:size-8" : "ml-0.5 size-5"} fill="currentColor">
                  <path d="M7 4.5v15l13-7.5z" />
                </svg>
              </span>
            </div>
          </div>
        )}
      </div>
      <figcaption className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm text-(--mist)">
        <span>{demo.summary}</span>
        {!src && (
          <Link href="/contact?topic=demo" className="lp-data shrink-0 text-xs text-(--paper) underline decoration-(--hi) decoration-2 underline-offset-4">
            {SHOW_PLACEHOLDERS ? "Video to come · book a live demo →" : "Book a live demo →"}
          </Link>
        )}
      </figcaption>
    </figure>
  );
}
