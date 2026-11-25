"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from "lucide-react";
import {
  MAX_ABOUT_HEADING,
  MAX_ABOUT_TEXT,
  MAX_CAPTION,
  MAX_FACTS,
  MAX_FACT_LENGTH,
  MAX_GALLERY,
  MAX_OWNER_NAME,
  type About,
  type GalleryPhoto,
} from "@leadgen/core/branding/about";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ACCEPTED_IMAGE_TYPES, shrinkOrKeep } from "@/lib/shrink-image";
import { cn } from "@/lib/utils";
import { Field, SaveForm, type Action } from "../form-kit";
import { Group, ImageField } from "./general-forms";

// Settings → Booking page → About you, and → Photos of your work: what makes
// the booking page's home read as the business's own, not a booking system's.

const FACT_EXAMPLES = ["Fully insured", "10 years' experience", "Ceramic coating approved", "Eco-friendly products"];

export function AboutForm({ about, businessName, action, readOnly }: { about: About; businessName: string; action: Action; readOnly: boolean }) {
  const [name, setName] = useState(about.name ?? "");
  // Bumped after a save so the photo picker starts empty again.
  const [generation, setGeneration] = useState(0);

  return (
    <SaveForm action={action} readOnly={readOnly} onSaved={() => setGeneration((g) => g + 1)}>
      {(errors) => (
        <div className="grid gap-8">
          <Group
            title="Why customers choose you"
            note="Up to four short points, shown under the main heading at the top of your booking page. Leave them blank to show none."
          >
            <div className="grid gap-3 @lg:grid-cols-2">
              {Array.from({ length: MAX_FACTS }, (_, i) => (
                <Field key={i} label={`Point ${i + 1}`} name={`fact_${i}`} error={errors[`fact_${i}`]}>
                  <Input
                    name={`fact_${i}`}
                    defaultValue={about.facts[i] ?? ""}
                    placeholder={`e.g. ${FACT_EXAMPLES[i]}`}
                    maxLength={MAX_FACT_LENGTH}
                  />
                </Field>
              ))}
            </div>
          </Group>

          <Group
            title="About you"
            note="A section on your home page with your photo and a few words in your own voice. It shows once you've written something."
          >
            <div className="grid gap-4 @lg:grid-cols-2">
              <Field label="Your name" name="name" error={errors.name} hint="As customers know you, like Dan, or Dan and Sophie.">
                <Input name="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={MAX_OWNER_NAME} autoComplete="off" />
              </Field>
              <Field
                label="Heading"
                name="heading"
                error={errors.heading}
                hint={`Blank shows "${name.trim() ? `Meet ${name.trim()}` : `About ${businessName}`}".`}
              >
                <Input name="heading" defaultValue={about.heading ?? ""} maxLength={MAX_ABOUT_HEADING} placeholder="e.g. Why I started" />
              </Field>
            </div>
            <Field
              label="Your story"
              name="text"
              error={errors.text}
              hint="Who you are, how long you've been doing it and what you care about. Leave a blank line between paragraphs."
            >
              <Textarea
                name="text"
                rows={6}
                defaultValue={about.text ?? ""}
                maxLength={MAX_ABOUT_TEXT}
                placeholder="e.g. I started valeting cars on my parents' drive in 2016. These days I've got a fully kitted van, but I still treat every car like it's my own…"
              />
            </Field>
            <ImageField
              key={`photo-${generation}`}
              label="Your photo"
              name="photo"
              current={about.photo_url}
              error={errors.photo}
              hint="Optional. You, or you at work. Portrait or square works best."
              maxEdge={1600}
              wide
            />
          </Group>
        </div>
      )}
    </SaveForm>
  );
}

// ---------------------------------------------------------------- Gallery

type Row = { id: string; caption: string } & ({ kind: "saved"; url: string } | { kind: "new"; file: File; preview: string });

// The host turns away a request over about 4.5 MB, so new photos are sent
// a batch at a time, under this much together.
const BATCH_BYTES = 3.5 * 1024 * 1024;

// Remounted (keyed on the saved photos) after each save, so the rows start
// from what's saved.
export function GalleryForm({ photos, action, readOnly }: { photos: GalleryPhoto[]; action: Action; readOnly: boolean }) {
  const [rows, setRows] = useState<Row[]>(() =>
    photos.map((p) => ({ id: p.url, kind: "saved", url: p.url, caption: p.caption ?? "" })),
  );
  const [problem, setProblem] = useState<string>();
  const [preparing, setPreparing] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  // Photos are added after they are prepared, with no typing or clicking to
  // tell the form it changed, so it is told here (an input event, which the
  // Save button listens for).
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    list.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }, [rows]);

  // The previews of picked photos go with the form.
  const previews = useRef(new Set<string>());
  useEffect(() => {
    const urls = previews.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const room = MAX_GALLERY - rows.length;
  const newBytes = rows.reduce((sum, r) => sum + (r.kind === "new" ? r.file.size : 0), 0);

  async function add(list: FileList | null) {
    setProblem(undefined);
    const picked = [...(list ?? [])];
    if (picker.current) picker.current.value = "";
    if (!picked.length) return;
    const usable = picked.filter((f) => ACCEPTED_IMAGE_TYPES.includes(f.type));
    const notes: string[] = [];
    if (usable.length < picked.length) notes.push("Some weren't JPG, PNG or WebP images, so they were left out.");
    if (usable.length > room) notes.push(`You can show up to ${MAX_GALLERY} photos, so only the first ${room} were added.`);

    setPreparing(true);
    const added: Row[] = [];
    let bytes = newBytes;
    for (const file of usable.slice(0, room)) {
      const small = await shrinkOrKeep(file, 2000, 0.85);
      if (bytes + small.size > BATCH_BYTES) {
        notes.push("That's as many as can go in one save. Save these, then add the rest.");
        break;
      }
      bytes += small.size;
      const preview = URL.createObjectURL(small);
      previews.current.add(preview);
      added.push({ id: crypto.randomUUID(), kind: "new", file: small, preview, caption: "" });
    }
    setPreparing(false);
    setRows((r) => [...r, ...added]);
    if (notes.length) setProblem(notes.join(" "));
  }

  const move = (from: number, to: number) =>
    setRows((r) => {
      const next = [...r];
      const [row] = next.splice(from, 1);
      next.splice(to, 0, row);
      return next;
    });

  return (
    <SaveForm action={action} readOnly={readOnly}>
      {() => (
        <div ref={list} className="grid gap-4">
          {rows.length > 0 ? (
            <ol className="grid gap-3">
              {rows.map((row, i) => (
                <li key={row.id} className="flex items-center gap-3 rounded-lg border p-2 pr-3">
                  <input type="hidden" name="photo" value={row.kind === "saved" ? `saved:${row.url}` : `new:${row.id}`} />
                  {row.kind === "new" && <NewFile name={`file_${row.id}`} file={row.file} />}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={row.kind === "saved" ? row.url : row.preview}
                    alt=""
                    className="h-16 w-24 shrink-0 rounded-md bg-muted object-cover"
                  />
                  <div className="grid min-w-0 flex-1 gap-1">
                    <Input
                      name="caption"
                      value={row.caption}
                      onChange={(e) => {
                        const caption = e.target.value;
                        setRows((r) => r.map((x) => (x.id === row.id ? { ...x, caption } : x)));
                      }}
                      maxLength={MAX_CAPTION}
                      placeholder="Caption (optional), e.g. Before and after: full valet"
                      aria-label={`Caption for photo ${i + 1}`}
                    />
                    {row.kind === "new" && <p className="text-xs text-muted-foreground">New: added when you save</p>}
                  </div>
                  {!readOnly && (
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button type="button" variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`Move photo ${i + 1} up`}>
                        <ArrowUp />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={i === rows.length - 1}
                        onClick={() => move(i, i + 1)}
                        aria-label={`Move photo ${i + 1} down`}
                      >
                        <ArrowDown />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setRows((r) => r.filter((x) => x.id !== row.id))}
                        aria-label={`Take photo ${i + 1} out`}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No photos yet. Your best before-and-afters do more than anything else on the page.
            </p>
          )}

          {!readOnly && (
            <div className="grid gap-2">
              <label
                className={cn(
                  "inline-flex h-11 w-fit cursor-pointer items-center gap-2 rounded-lg border px-4 text-sm font-medium transition hover:bg-muted has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                  (room === 0 || preparing) && "pointer-events-none opacity-50",
                )}
              >
                <ImagePlus className="size-4" aria-hidden />
                {preparing ? "Preparing the photos…" : "Add photos"}
                <input
                  ref={picker}
                  type="file"
                  multiple
                  accept={ACCEPTED_IMAGE_TYPES.join(",")}
                  className="sr-only"
                  disabled={room === 0 || preparing}
                  onChange={(e) => void add(e.currentTarget.files)}
                />
              </label>
              <p className={cn("text-xs", problem ? "text-destructive" : "text-muted-foreground")} role={problem ? "alert" : undefined}>
                {problem ??
                  (room === 0
                    ? `That's the most you can show (${MAX_GALLERY}). Take one out to add another.`
                    : `JPG, PNG or WebP, up to ${MAX_GALLERY} photos. The first three show on your page, so use the arrows to put your best first.`)}
              </p>
            </div>
          )}
        </div>
      )}
    </SaveForm>
  );
}

// A picked photo as a file field, so Save sends it with the form. Hidden:
// the row shows the photo.
export function NewFile({ name, file }: { name: string; file: File }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const files = new DataTransfer();
    files.items.add(file);
    ref.current.files = files.files;
  }, [file]);
  return <input ref={ref} type="file" name={name} hidden tabIndex={-1} aria-hidden />;
}
