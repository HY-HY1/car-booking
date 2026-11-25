"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2 } from "lucide-react";
import { MAX_PAIRS, MAX_PAIR_CAPTION, type BeforeAfterPair } from "@leadgen/core/booking/before-after";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { serviceImageUrl } from "@/lib/pricing-fields";
import { ACCEPTED_IMAGE_TYPES, shrinkOrKeep } from "@/lib/shrink-image";
import { cn } from "@/lib/utils";
import { SaveForm, type Action } from "./form-kit";
import { NewFile } from "./settings/about-forms";

// Pricing → a service → Before and after: pairs of photos of the same car
// before the visit and after it, shown on the service's page so customers see
// the starting point and the finish to expect. Saved on its own (photos are
// big and the host limits one save), a pair at a time or several together.

type Img = { id: string; kind: "saved"; path: string } | { id: string; kind: "new"; file: File; preview: string };
type Pair = { id: string; caption: string; before: Img | null; after: Img | null };

// The host turns away a request over about 4.5 MB.
const BATCH_BYTES = 3.5 * 1024 * 1024;

const ref = (img: Img | null) => (!img ? "" : img.kind === "saved" ? `saved:${img.path}` : `new:${img.id}`);
const src = (img: Img) => (img.kind === "saved" ? serviceImageUrl(img.path)! : img.preview);

export function BeforeAfterForm({ pairs: saved, action, readOnly }: { pairs: BeforeAfterPair[]; action: Action; readOnly: boolean }) {
  const [pairs, setPairs] = useState<Pair[]>(() =>
    saved.map((p) => ({
      id: crypto.randomUUID(),
      caption: p.caption ?? "",
      before: { id: crypto.randomUUID(), kind: "saved", path: p.before },
      after: { id: crypto.randomUUID(), kind: "saved", path: p.after },
    })),
  );
  const [problem, setProblem] = useState<string>();
  const list = useRef<HTMLDivElement>(null);

  // Previews of picked photos go with the form.
  const previews = useRef(new Set<string>());
  useEffect(() => {
    const urls = previews.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);
  // Photos and moves aren't typing, so the Save button is told the form changed.
  useEffect(() => {
    list.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }, [pairs]);

  const newBytes = pairs.reduce((sum, p) => sum + [p.before, p.after].reduce((s, i) => s + (i?.kind === "new" ? i.file.size : 0), 0), 0);

  async function pick(pairId: string, side: "before" | "after", file: File | undefined) {
    setProblem(undefined);
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return setProblem("Use a JPG, PNG or WebP photo.");
    const small = await shrinkOrKeep(file, 1600, 0.85);
    const replacing = pairs.find((p) => p.id === pairId)?.[side];
    const budget = newBytes - (replacing?.kind === "new" ? replacing.file.size : 0);
    if (budget + small.size > BATCH_BYTES) return setProblem("That's as many new photos as can go in one save. Save these first, then add more.");
    const preview = URL.createObjectURL(small);
    previews.current.add(preview);
    setPairs((ps) => ps.map((p) => (p.id === pairId ? { ...p, [side]: { id: crypto.randomUUID(), kind: "new", file: small, preview } } : p)));
  }

  const move = (from: number, to: number) =>
    setPairs((ps) => {
      if (to < 0 || to >= ps.length) return ps;
      const next = [...ps];
      const [p] = next.splice(from, 1);
      next.splice(to, 0, p);
      return next;
    });

  return (
    <SaveForm action={action} readOnly={readOnly} submitLabel="Save photos">
      {(errors) => (
        <div ref={list} className="grid gap-4">
          {pairs.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No pairs yet. Take a photo of the car when you arrive and the same view when you finish: nothing sells the
              job better.
            </p>
          ) : (
            <ol className="grid gap-4">
              {pairs.map((p, i) => (
                <li key={p.id} className="grid gap-3 rounded-lg border p-3 sm:p-4">
                  <input type="hidden" name="pair" value={p.id} />
                  <input type="hidden" name={`before_${p.id}`} value={ref(p.before)} />
                  <input type="hidden" name={`after_${p.id}`} value={ref(p.after)} />
                  {p.before?.kind === "new" && <NewFile name={`file_${p.before.id}`} file={p.before.file} />}
                  {p.after?.kind === "new" && <NewFile name={`file_${p.after.id}`} file={p.after.file} />}

                  <div className="grid grid-cols-2 gap-3">
                    {(["before", "after"] as const).map((side) => (
                      <Slot
                        key={side}
                        label={side === "before" ? "Before" : "After"}
                        image={p[side]}
                        disabled={readOnly}
                        onPick={(file) => void pick(p.id, side, file)}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      name={`caption_${p.id}`}
                      value={p.caption}
                      onChange={(e) => {
                        const caption = e.target.value;
                        setPairs((ps) => ps.map((x) => (x.id === p.id ? { ...x, caption } : x)));
                      }}
                      maxLength={MAX_PAIR_CAPTION}
                      placeholder="Caption (optional), e.g. Ford Focus, heavy pet hair"
                      aria-label={`Caption for pair ${i + 1}`}
                    />
                    {!readOnly && (
                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button type="button" variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`Move pair ${i + 1} up`}>
                          <ArrowUp />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={i === pairs.length - 1}
                          onClick={() => move(i, i + 1)}
                          aria-label={`Move pair ${i + 1} down`}
                        >
                          <ArrowDown />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setPairs((ps) => ps.filter((x) => x.id !== p.id))}
                          aria-label={`Remove pair ${i + 1}`}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    )}
                  </div>
                  {errors[`pair_${i}`] && (
                    <p role="alert" className="text-sm text-destructive">
                      {errors[`pair_${i}`]}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}

          {problem && (
            <p role="alert" className="text-sm text-destructive">
              {problem}
            </p>
          )}
          {!readOnly && (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={pairs.length >= MAX_PAIRS}
                onClick={() => setPairs((ps) => [...ps, { id: crypto.randomUUID(), caption: "", before: null, after: null }])}
              >
                <Plus aria-hidden /> Add a pair
              </Button>
              <p className="text-xs text-muted-foreground">
                {pairs.length >= MAX_PAIRS
                  ? `That's the most you can show (${MAX_PAIRS}).`
                  : `Up to ${MAX_PAIRS} pairs. The same angle in both photos shows the difference best.`}
              </p>
            </div>
          )}
        </div>
      )}
    </SaveForm>
  );
}

// One side of a pair: the photo, or a box to add it.
function Slot({ label, image, disabled, onPick }: { label: string; image: Img | null; disabled: boolean; onPick: (file: File | undefined) => void }) {
  return (
    <label
      className={cn(
        "group relative grid aspect-4/3 cursor-pointer place-items-center overflow-hidden rounded-lg border bg-muted/50 text-sm text-muted-foreground transition hover:border-foreground/30 has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
        !image && "border-dashed",
        disabled && "pointer-events-none",
      )}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src(image)} alt={`${label} photo`} className="absolute inset-0 size-full object-cover" />
      ) : (
        <span className="grid justify-items-center gap-1">
          <ImagePlus className="size-5" aria-hidden />
          Add the {label.toLowerCase()} photo
        </span>
      )}
      <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">{label}</span>
      {image && !disabled && (
        <span className="absolute right-2 bottom-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white opacity-0 transition group-hover:opacity-100">
          Change
        </span>
      )}
      <input
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        className="sr-only"
        disabled={disabled}
        aria-label={image ? `Change the ${label.toLowerCase()} photo` : `Add the ${label.toLowerCase()} photo`}
        onChange={(e) => {
          onPick(e.currentTarget.files?.[0]);
          e.currentTarget.value = "";
        }}
      />
    </label>
  );
}
