"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Move, RotateCcw } from "lucide-react";
import type { CoverPosition } from "@leadgen/core/branding/cover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Choosing which part of the cover image shows. The banner it sits in is wide
// on a computer and tall on a phone, so a fixed crop can't suit both: the
// owner drags the picture instead, and the booking page keeps that point in
// view at every size (CSS object-position). The two frames are the banner's
// shape on each; dragging either moves both. Arrow keys work too.

export const CENTRE: CoverPosition = { x: 50, y: 50 };

// Roughly the booking page's home banner (sites/[tenant]/page.tsx) at
// 1280px wide and at 390px.
const FRAMES = [
  { key: "computer", label: "Computer", aspect: "aspect-[3/1]" },
  { key: "phone", label: "Phone", aspect: "aspect-[6/7]" },
] as const;

const clamp = (n: number) => Math.round(Math.min(100, Math.max(0, n)) * 10) / 10;

export function CoverPositioner({
  src,
  value,
  onChange,
  disabled,
}: {
  src: string;
  value: CoverPosition;
  onChange: (value: CoverPosition) => void;
  disabled?: boolean;
}) {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  // While dragging: where it started, and how far the picture can move in
  // that frame (its overflow in pixels; 0 = that way it already fits).
  const drag = useRef<{ x0: number; y0: number; start: CoverPosition; ox: number; oy: number } | null>(null);
  const centred = value.x === CENTRE.x && value.y === CENTRE.y;

  function start(e: PointerEvent<HTMLDivElement>) {
    if (disabled || !natural || e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const frame = e.currentTarget.getBoundingClientRect();
    const scale = Math.max(frame.width / natural.w, frame.height / natural.h);
    drag.current = {
      x0: e.clientX,
      y0: e.clientY,
      start: value,
      ox: natural.w * scale - frame.width,
      oy: natural.h * scale - frame.height,
    };
  }

  function move(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    // Dragging the picture right shows more of its left side: a lower x.
    onChange({
      x: d.ox > 1 ? clamp(d.start.x - ((e.clientX - d.x0) / d.ox) * 100) : d.start.x,
      y: d.oy > 1 ? clamp(d.start.y - ((e.clientY - d.y0) / d.oy) * 100) : d.start.y,
    });
  }

  function end() {
    drag.current = null;
  }

  // Arrows move the picture the way it's dragged; Shift moves it further.
  function nudge(e: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    const step = e.shiftKey ? 10 : 2;
    const by: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    const delta = by[e.key];
    if (!delta) return;
    e.preventDefault();
    onChange({ x: clamp(value.x + delta[0]), y: clamp(value.y + delta[1]) });
  }

  return (
    <div className="grid gap-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Position the cover image</p>
          <p id="cover-position-hint" className="text-xs text-muted-foreground">
            Drag the picture to choose what shows. The banner is wide on a computer and tall on a phone, so check both.
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(CENTRE)} disabled={disabled || centred}>
          <RotateCcw /> Centre
        </Button>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_9rem] items-end gap-3">
        {FRAMES.map((frame) => (
          <figure key={frame.key} className="grid gap-1.5">
            <div
              role="group"
              tabIndex={disabled ? -1 : 0}
              aria-label={`Cover image as a ${frame.label.toLowerCase()} shows it. Drag, or use the arrow keys, to move it.`}
              aria-describedby="cover-position-hint"
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
              onKeyDown={nudge}
              className={cn(
                "group relative touch-none overflow-hidden rounded-lg border bg-muted outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50",
                frame.aspect,
                disabled ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                draggable={false}
                onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                className="pointer-events-none absolute inset-0 size-full object-cover"
                style={{ objectPosition: `${value.x}% ${value.y}%` }}
              />
              <span
                aria-hidden
                className="pointer-events-none absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white opacity-90 transition group-active:opacity-0"
              >
                <Move className="size-3" /> Drag
              </span>
            </div>
            <figcaption className="text-xs text-muted-foreground">{frame.label}</figcaption>
          </figure>
        ))}
      </div>
      <input type="hidden" name="cover_x" value={value.x} />
      <input type="hidden" name="cover_y" value={value.y} />
    </div>
  );
}
