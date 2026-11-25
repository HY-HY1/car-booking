"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { cn } from "@/lib/cn";

// Videos of the business's work on the home page (Settings → Booking page →
// Videos of your work): one at a time, the first to start with, and arrows
// (or the dots) to step through the rest. Each is shown in its own shape:
// upright for the phone clips most people film (a little smaller on a
// computer, so it doesn't tower over the words), wide for the rest. An upload
// plays right here. A YouTube, Vimeo, TikTok or Instagram video shows a still
// or a plain card until someone presses play, so nothing from those sites
// loads (or tracks) before then.

export type ShowcaseVideo =
  | { key: string; kind: "upload"; src: string; vertical: boolean; caption?: string }
  | { key: string; kind: "link"; embed: string; thumbnail: string | null; provider: string; vertical: boolean; caption?: string };

export function VideoShowcase({ videos, businessName }: { videos: ShowcaseVideo[]; businessName: string }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  // An upload's real shape once it's loaded, in case the saved one is wrong.
  const [shapes, setShapes] = useState<Record<string, boolean>>({});
  const current = videos[index];
  const vertical = shapes[current.key] ?? current.vertical;
  const go = (i: number) => {
    setIndex((i + videos.length) % videos.length);
    setPlaying(false);
  };
  const label = (v: ShowcaseVideo, i: number) => v.caption ?? `Video ${i + 1} of ${businessName}'s work`;

  // A set width from tablet up, so the section can sit the words and the
  // video side by side as one centred pair.
  return (
    <div className={cn("mx-auto grid w-full gap-4", vertical ? "max-w-88 md:w-64 lg:w-72" : "md:w-md lg:w-xl")}>
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-2xl bg-neutral-950 shadow-lg ring-1 ring-black/10",
          vertical ? "aspect-9/16" : "aspect-video",
        )}
        role="group"
        aria-roledescription="video player"
        aria-label={`${label(current, index)}${videos.length > 1 ? `, ${index + 1} of ${videos.length}` : ""}`}
      >
        {current.kind === "upload" ? (
          // A key per video, so moving on stops the last one.
          <video
            key={current.key}
            src={current.src}
            controls
            playsInline
            preload="metadata"
            onLoadedMetadata={(e) => {
              const { videoWidth: w, videoHeight: h } = e.currentTarget;
              if (w && h) setShapes((s) => ({ ...s, [current.key]: h >= w }));
            }}
            className="absolute inset-0 size-full object-contain"
          >
            <track kind="captions" />
          </video>
        ) : playing ? (
          <iframe
            key={current.key}
            src={current.embed}
            title={label(current, index)}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="absolute inset-0 size-full border-0"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group absolute inset-0 grid place-items-center text-white focus-visible:outline-none"
            aria-label={`Play ${label(current, index)} (from ${current.provider})`}
          >
            {current.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.thumbnail} alt="" className="absolute inset-0 size-full object-cover opacity-90 transition group-hover:opacity-100" />
            ) : (
              <span aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgb(255_255_255/0.12),transparent_70%)]" />
            )}
            <span aria-hidden className="relative grid size-18 place-items-center rounded-full bg-white/95 text-neutral-950 shadow-xl transition group-hover:scale-105 group-focus-visible:ring-4 group-focus-visible:ring-white/60">
              <Play className="ml-1 size-7 fill-current" />
            </span>
            <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium backdrop-blur">Plays from {current.provider}</span>
          </button>
        )}

        {videos.length > 1 && (
          <>
            <Arrow side="left" onClick={() => go(index - 1)} />
            <Arrow side="right" onClick={() => go(index + 1)} />
          </>
        )}
      </div>

      {(current.caption || videos.length > 1) && (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <p className="min-w-0 text-sm text-pretty text-neutral-700">{current.caption}</p>
          {videos.length > 1 && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-neutral-500 tabular-nums">
                {index + 1} / {videos.length}
              </span>
              <div className="flex items-center gap-1.5">
                {videos.map((v, i) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => go(i)}
                    aria-label={`Show ${label(v, i)}`}
                    aria-current={i === index}
                    className={cn("h-2 rounded-full transition-all", i === index ? "w-6 bg-brand" : "w-2 bg-neutral-300 hover:bg-neutral-400")}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Arrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous video" : "Next video"}
      className={cn(
        "absolute top-1/2 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-neutral-900 shadow-lg transition hover:bg-white focus-visible:ring-4 focus-visible:ring-white/60 focus-visible:outline-none",
        side === "left" ? "left-3" : "right-3",
      )}
    >
      <Icon className="size-5" />
    </button>
  );
}
