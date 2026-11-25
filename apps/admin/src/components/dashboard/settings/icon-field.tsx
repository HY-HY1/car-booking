"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ImagePlus, Minus, Plus } from "lucide-react";
import { MAX_ICON_ZOOM, STORED_ICON_SIZE, squareCrop } from "@leadgen/core/branding/icon-crop";
import { Checkbox } from "@/components/ui/checkbox";
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/shrink-image";
import { cn } from "@/lib/utils";

// The browser tab icon: pick a picture, then drag and zoom a square over it.
// What's inside the square is drawn at the stored size (512px) as a PNG and
// sent as the form's `tab_icon` file; the server crops anything that isn't
// square too (core branding/tab-icon.ts), so the icon is always the right
// shape. Previews show it in a browser tab and on a phone's home screen.

const VIEW = 224;

export function IconField({
  name,
  current,
  autoUrl,
  error,
  disabled,
}: {
  name: string;
  // The uploaded icon, if there is one.
  current?: string;
  // The one made from the logo or initial, shown while there's none.
  autoUrl: string;
  error?: string;
  disabled?: boolean;
}) {
  const [source, setSource] = useState<{ url: string; w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [centre, setCentre] = useState({ x: 0.5, y: 0.5 });
  const [cropped, setCropped] = useState<string | null>(null);
  const [problem, setProblem] = useState<string>();
  const [removing, setRemoving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const image = useRef<HTMLImageElement | null>(null);
  const drag = useRef<{ x: number; y: number; start: { x: number; y: number } } | null>(null);

  // Object URLs go with the field.
  useEffect(() => () => void (source && URL.revokeObjectURL(source.url)), [source]);
  useEffect(() => () => void (cropped && URL.revokeObjectURL(cropped)), [cropped]);

  const crop = source ? squareCrop(source.w, source.h, zoom, centre) : null;
  const scale = crop ? VIEW / crop.side : 1;

  // Draws the square at the stored size and puts it in the form's file field.
  useEffect(() => {
    if (!source || !crop || !image.current) return;
    const timer = window.setTimeout(() => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = STORED_ICON_SIZE;
      canvas.getContext("2d")!.drawImage(image.current!, crop.sx, crop.sy, crop.side, crop.side, 0, 0, STORED_ICON_SIZE, STORED_ICON_SIZE);
      canvas.toBlob((blob) => {
        if (!blob || !fileInput.current) return;
        const files = new DataTransfer();
        files.items.add(new File([blob], "tab-icon.png", { type: "image/png" }));
        fileInput.current.files = files.files;
        // Not typed, so the Save button is told the form changed.
        fileInput.current.dispatchEvent(new Event("input", { bubbles: true }));
        setCropped(URL.createObjectURL(blob));
      }, "image/png");
    }, 120);
    return () => window.clearTimeout(timer);
    // crop is worked out from these; listing it would redraw every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, zoom, centre.x, centre.y]);

  function pick(file: File | undefined) {
    setProblem(undefined);
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return setProblem("Use a JPG, PNG or WebP image.");
    if (file.size > MAX_UPLOAD_BYTES * 3) return setProblem("That image is too large. Try a smaller one.");
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      image.current = img;
      setZoom(1);
      setCentre({ x: 0.5, y: 0.5 });
      setRemoving(false);
      setSource({ url, w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => setProblem("That picture couldn't be opened. Try another.");
    img.src = url;
  }

  function moveBy(dx: number, dy: number, start = centre) {
    if (!source || !crop) return;
    // Dragging the picture right moves the square left over it.
    const next = squareCrop(source.w, source.h, zoom, { x: start.x - dx / scale / source.w, y: start.y - dy / scale / source.h }).centre;
    setCentre(next);
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (disabled || e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, start: centre };
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 40 : 8;
    const keys: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (keys[e.key]) {
      e.preventDefault();
      moveBy(...keys[e.key]);
    } else if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(MAX_ICON_ZOOM, z + 0.25));
    else if (e.key === "-") setZoom((z) => Math.max(1, z - 0.25));
  }

  const shown = cropped ?? (removing ? autoUrl : (current ?? autoUrl));

  return (
    <div className="grid gap-3">
      {/* What Save sends: the cropped square. */}
      <input ref={fileInput} type="file" name={name} hidden tabIndex={-1} aria-hidden />

      <div className="flex flex-wrap items-start gap-6">
        {source && crop ? (
          <div className="grid gap-2">
            <div
              role="slider"
              tabIndex={disabled ? -1 : 0}
              aria-label="Where the icon sits in the picture. Drag, or use the arrow keys; plus and minus zoom."
              aria-valuenow={zoom}
              aria-valuemin={1}
              aria-valuemax={MAX_ICON_ZOOM}
              aria-valuetext={`${Math.round(crop.centre.x * 100)}% across, ${Math.round(crop.centre.y * 100)}% down, zoom ${zoom.toFixed(2)}`}
              onPointerDown={onPointerDown}
              onPointerMove={(e) => drag.current && moveBy(e.clientX - drag.current.x, e.clientY - drag.current.y, drag.current.start)}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
              onKeyDown={onKeyDown}
              className="relative cursor-grab touch-none overflow-hidden rounded-lg bg-[repeating-conic-gradient(#e5e5e5_0_25%,#fff_0_50%)] bg-[length:16px_16px] ring-1 ring-border outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
              style={{ width: VIEW, height: VIEW }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={source.url}
                alt=""
                draggable={false}
                className="pointer-events-none absolute max-w-none select-none"
                style={{ width: source.w * scale, height: source.h * scale, left: -crop.sx * scale, top: -crop.sy * scale }}
              />
              {/* Where the rounded home-screen shape cuts the corners. */}
              <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[22%] ring-1 ring-white/80 ring-inset" />
            </div>
            <div className="flex items-center gap-2" style={{ width: VIEW }}>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
                aria-label="Zoom out"
                className="grid size-8 place-items-center rounded-md hover:bg-muted"
                disabled={disabled}
              >
                <Minus className="size-4" />
              </button>
              <input
                type="range"
                min={1}
                max={MAX_ICON_ZOOM}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                aria-label="Zoom"
                className="min-w-0 flex-1 accent-primary"
                disabled={disabled}
              />
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(MAX_ICON_ZOOM, z + 0.25))}
                aria-label="Zoom in"
                className="grid size-8 place-items-center rounded-md hover:bg-muted"
                disabled={disabled}
              >
                <Plus className="size-4" />
              </button>
            </div>
          </div>
        ) : null}

        <div className="grid content-start gap-3">
          <Previews src={shown} />
          {!disabled && (
            <label className="inline-flex h-9 w-fit cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium transition hover:bg-muted has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
              <ImagePlus className="size-4" aria-hidden />
              {source ? "Choose another picture" : current ? "Change icon" : "Upload your own"}
              <input
                type="file"
                accept={ACCEPTED_IMAGE_TYPES.join(",")}
                className="sr-only"
                onChange={(e) => {
                  pick(e.currentTarget.files?.[0]);
                  e.currentTarget.value = "";
                }}
              />
            </label>
          )}
          {source && <p className="max-w-56 text-xs text-muted-foreground">Drag the picture and zoom until the square shows what you want. It&apos;s saved when you press Save.</p>}
          {current && !source && !disabled && (
            <Checkbox
              name={`remove_${name}`}
              labelClassName={cn(removing && "text-destructive")}
              onChange={(e) => setRemoving(e.target.checked)}
            >
              {removing ? "Removed when you save" : "Go back to the automatic icon"}
            </Checkbox>
          )}
        </div>
      </div>
      {(problem ?? error) && (
        <p role="alert" className="text-sm text-destructive">
          {problem ?? error}
        </p>
      )}
    </div>
  );
}

// The icon where it'll be seen: a browser tab, and a phone's home screen.
function Previews({ src }: { src: string }) {
  return (
    <div className="flex items-end gap-4" aria-hidden>
      <div className="grid gap-1 text-center">
        <div className="flex w-40 items-center gap-2 rounded-t-lg border border-b-0 bg-muted/60 px-2.5 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="size-4 shrink-0 rounded-sm object-cover" />
          <span className="h-1.5 flex-1 rounded bg-muted-foreground/25" />
        </div>
        <span className="text-xs text-muted-foreground">Browser tab</span>
      </div>
      <div className="grid justify-items-center gap-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="size-14 rounded-[22%] object-cover shadow-sm ring-1 ring-black/5" />
        <span className="text-xs text-muted-foreground">Phone</span>
      </div>
    </div>
  );
}
