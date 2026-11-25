"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ImagePlus, Plus, ShieldAlert, Trash2, UserRound, X } from "lucide-react";
import {
  MAX_PHOTO_LABEL,
  MAX_TESTIMONIALS,
  MAX_TESTIMONIAL_NAME,
  MAX_TESTIMONIAL_PHOTOS,
  MAX_TESTIMONIAL_TEXT,
  TESTIMONIAL_SOURCES,
  type ReviewSettings,
  type TestimonialSource,
} from "@leadgen/core/branding/reviews";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ACCEPTED_IMAGE_TYPES, shrinkOrKeep } from "@/lib/shrink-image";
import { cn } from "@/lib/utils";
import { Field, SaveForm, type Action } from "./form-kit";
import { NewFile } from "./settings/about-forms";

// Reviews → Testimonials: the booking page's reviews section on or off,
// where its Google reviews come from (picked on the Google reviews tab), and
// testimonials customers sent some other way, each with the customer's
// picture and labelled photos of the car if the owner has them. Each
// testimonial is ticked as a real customer's own words before it can be
// saved.

type Img = { id: string; kind: "saved"; url: string } | { id: string; kind: "new"; file: File; preview: string };
type Photo = Img & { label: string };
type Row = {
  id: string;
  name: string;
  text: string;
  source?: TestimonialSource;
  genuine: boolean;
  avatar: Img | null;
  photos: Photo[];
};

// The host turns away a request over about 4.5 MB, so new images go up a
// batch at a time, under this much together.
const BATCH_BYTES = 3.5 * 1024 * 1024;

const ref = (img: Img) => (img.kind === "saved" ? `saved:${img.url}` : `new:${img.id}`);
const src = (img: Img) => (img.kind === "saved" ? img.url : img.preview);

export function TestimonialsForm({
  settings,
  google,
  reviewsUrl,
  integrationsUrl,
  action,
  readOnly,
}: {
  settings: ReviewSettings;
  // Google is connected with a location, so its reviews can show.
  google: boolean;
  // The Google reviews tab, where they're picked.
  reviewsUrl: string;
  integrationsUrl: string;
  action: Action;
  readOnly: boolean;
}) {
  const [show, setShow] = useState(settings.show);
  const [rows, setRows] = useState<Row[]>(() =>
    settings.testimonials.map((t) => ({
      id: crypto.randomUUID(),
      name: t.name,
      text: t.text,
      source: t.source,
      genuine: true,
      avatar: t.avatar_url ? { id: crypto.randomUUID(), kind: "saved", url: t.avatar_url } : null,
      photos: t.photos.map((p) => ({ id: crypto.randomUUID(), kind: "saved", url: p.url, label: p.label ?? "" })),
    })),
  );
  const [problem, setProblem] = useState<{ row: string; text: string } | null>(null);
  const list = useRef<HTMLOListElement>(null);
  const focusNext = useRef<string | null>(null);

  // Previews of picked images go with the form.
  const previews = useRef(new Set<string>());
  useEffect(() => {
    const urls = previews.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  // Images and moves aren't typing, so the Save button is told the form
  // changed (it listens for input events) whenever the rows do.
  useEffect(() => {
    if (focusNext.current) list.current?.querySelector<HTMLInputElement>(`[data-row="${focusNext.current}"] input[name="name"]`)?.focus();
    focusNext.current = null;
    list.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }, [rows]);

  const update = (id: string, patch: Partial<Row> | ((row: Row) => Partial<Row>)) =>
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...(typeof patch === "function" ? patch(x) : patch) } : x)));
  const move = (from: number, to: number) =>
    setRows((r) => {
      if (to < 0 || to >= r.length) return r;
      const next = [...r];
      const [row] = next.splice(from, 1);
      next.splice(to, 0, row);
      return next;
    });

  const newBytes = rows.reduce(
    (sum, r) =>
      sum + (r.avatar?.kind === "new" ? r.avatar.file.size : 0) + r.photos.reduce((s, p) => s + (p.kind === "new" ? p.file.size : 0), 0),
    0,
  );

  // Picked files → shrunk images, as many as fit in this save.
  async function prepare(rowId: string, files: FileList | null, maxEdge: number, room: number) {
    setProblem(null);
    const picked = [...(files ?? [])].filter((f) => ACCEPTED_IMAGE_TYPES.includes(f.type));
    if (!picked.length) {
      if (files?.length) setProblem({ row: rowId, text: "Use JPG, PNG or WebP images." });
      return [];
    }
    const ready: { id: string; kind: "new"; file: File; preview: string }[] = [];
    let bytes = newBytes;
    for (const file of picked.slice(0, room)) {
      const small = await shrinkOrKeep(file, maxEdge, 0.85);
      if (bytes + small.size > BATCH_BYTES) {
        setProblem({ row: rowId, text: "That's as many images as can go in one save. Save these, then add the rest." });
        break;
      }
      bytes += small.size;
      const preview = URL.createObjectURL(small);
      previews.current.add(preview);
      ready.push({ id: crypto.randomUUID(), kind: "new", file: small, preview });
    }
    if (picked.length > room) setProblem({ row: rowId, text: `Up to ${MAX_TESTIMONIAL_PHOTOS} photos each, so only the first ${room} were added.` });
    return ready;
  }

  const pinned = settings.pinned.length;

  return (
    <SaveForm action={action} readOnly={readOnly}>
      {(errors) => (
        <div className="grid gap-6">
          <div className="grid gap-3 rounded-lg border p-4">
            <Switch
              name="show"
              checked={show}
              onChange={(e) => setShow(e.target.checked)}
              description="A section on your home page quoting what customers say, from Google and from the testimonials below."
            >
              Show reviews on your booking page
            </Switch>
            <p className="text-sm text-muted-foreground">
              {google ? (
                <>
                  {pinned
                    ? `${pinned} Google review${pinned === 1 ? "" : "s"} picked to show.`
                    : "Your newest 4 and 5 star Google reviews show automatically."}{" "}
                  <Link href={reviewsUrl} className="font-medium text-foreground underline underline-offset-2">
                    {pinned ? "Change them under Google reviews" : "Pick your own under Google reviews"}
                  </Link>
                  .
                </>
              ) : (
                <>
                  <Link href={integrationsUrl} className="font-medium text-foreground underline underline-offset-2">
                    Connect Google
                  </Link>{" "}
                  to show your Google rating and reviews too.
                </>
              )}
            </p>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-1">
              <h3 className="text-sm font-semibold">Testimonials</h3>
              <p className="text-sm text-muted-foreground">
                Kind words customers sent you another way, like a text, an email or a message on Facebook. They show after
                your Google reviews, with where they came from and without stars. Customers can tap one to see it bigger,
                with its photos.
              </p>
            </div>

            <div
              role="note"
              className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
            >
              <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
              <div className="grid gap-1.5">
                <p className="font-semibold">Only add genuine reviews</p>
                <p>
                  Every testimonial must come from a real customer, in their own words. Don&apos;t write, change or pay for
                  them, or add ones from friends or family posing as customers. Fake or misleading reviews are illegal in the
                  UK under the Digital Markets, Competition and Consumers Act 2024, and can mean large fines.
                </p>
                <p>
                  Keep the original message, in case you&apos;re ever asked to show where it came from. Only add a
                  customer&apos;s picture with their permission, and only photos of the car the review is about.
                </p>
              </div>
            </div>

            {rows.length > 0 && (
              <ol ref={list} className="grid gap-3">
                {rows.map((row, i) => (
                  <li key={row.id} data-row={row.id} className="grid gap-4 rounded-lg border bg-card p-4">
                    <input type="hidden" name="row" value={row.id} />
                    <input type="hidden" name="avatar" value={row.avatar ? ref(row.avatar) : ""} />
                    {row.avatar?.kind === "new" && <NewFile name={`file_${row.avatar.id}`} file={row.avatar.file} />}

                    <div className="grid gap-3 @lg:grid-cols-[auto_minmax(0,1fr)_14rem] @lg:items-start">
                      <AvatarPicker
                        image={row.avatar}
                        name={row.name}
                        disabled={readOnly}
                        onPick={async (files) => {
                          const [img] = await prepare(row.id, files, 400, 1);
                          if (img) update(row.id, { avatar: img });
                        }}
                        onRemove={() => update(row.id, { avatar: null })}
                      />
                      <Field label="Who said it" name={`name_${i}`} error={errors[`name_${i}`]}>
                        <Input
                          name="name"
                          value={row.name}
                          onChange={(e) => update(row.id, { name: e.target.value })}
                          maxLength={MAX_TESTIMONIAL_NAME}
                          placeholder="e.g. Sarah, Cheltenham"
                        />
                      </Field>
                      <Field label="Where it came from" name={`source_${i}`}>
                        <Select
                          name="source"
                          value={row.source ?? ""}
                          onChange={(e) => update(row.id, { source: (e.target.value || undefined) as Row["source"] })}
                        >
                          <option value="">Don&apos;t say</option>
                          {Object.entries(TESTIMONIAL_SOURCES).map(([k, label]) => (
                            <option key={k} value={k}>
                              {label}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>

                    <Field
                      label="What they said"
                      name={`text_${i}`}
                      error={errors[`text_${i}`]}
                      hint="Exactly as they wrote it. You can leave out parts, but not change words."
                    >
                      <Textarea
                        name="text"
                        rows={3}
                        value={row.text}
                        onChange={(e) => update(row.id, { text: e.target.value })}
                        maxLength={MAX_TESTIMONIAL_TEXT}
                        placeholder="e.g. Car looks better than the day I bought it. Thanks so much!"
                      />
                    </Field>

                    <div className="grid gap-2">
                      <p className="text-sm font-medium">
                        Photos of the car <span className="font-normal text-muted-foreground">(optional, up to {MAX_TESTIMONIAL_PHOTOS})</span>
                      </p>
                      {row.photos.length > 0 && (
                        <ul className="grid gap-2 @lg:grid-cols-2">
                          {row.photos.map((p, n) => (
                            <li key={p.id} className="flex items-center gap-2 rounded-lg border p-1.5 pr-2">
                              <input type="hidden" name={`photo_${row.id}`} value={ref(p)} />
                              {p.kind === "new" && <NewFile name={`file_${p.id}`} file={p.file} />}
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={src(p)} alt="" className="h-12 w-16 shrink-0 rounded-md bg-muted object-cover" />
                              <Input
                                name={`photo_label_${row.id}`}
                                value={p.label}
                                onChange={(e) => {
                                  const label = e.target.value;
                                  update(row.id, (r) => ({ photos: r.photos.map((x) => (x.id === p.id ? { ...x, label } : x)) }));
                                }}
                                maxLength={MAX_PHOTO_LABEL}
                                placeholder={n === 0 ? "Label, e.g. Before" : "Label, e.g. After"}
                                aria-label={`Label for photo ${n + 1}`}
                                className="h-9"
                              />
                              {!readOnly && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  className="shrink-0 text-destructive hover:text-destructive"
                                  onClick={() => update(row.id, (r) => ({ photos: r.photos.filter((x) => x.id !== p.id) }))}
                                  aria-label={`Remove photo ${n + 1}`}
                                >
                                  <X />
                                </Button>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                      {!readOnly && row.photos.length < MAX_TESTIMONIAL_PHOTOS && (
                        <label className="inline-flex h-9 w-fit cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium transition hover:bg-muted has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
                          <ImagePlus className="size-4" aria-hidden />
                          Add photos
                          <input
                            type="file"
                            multiple
                            accept={ACCEPTED_IMAGE_TYPES.join(",")}
                            className="sr-only"
                            onChange={async (e) => {
                              const input = e.currentTarget;
                              const added = await prepare(row.id, input.files, 1600, MAX_TESTIMONIAL_PHOTOS - row.photos.length);
                              input.value = "";
                              if (added.length) update(row.id, (r) => ({ photos: [...r.photos, ...added.map((a) => ({ ...a, label: "" }))] }));
                            }}
                          />
                        </label>
                      )}
                      {(problem?.row === row.id || errors[`photos_${i}`]) && (
                        <p role="alert" className="text-sm text-destructive">
                          {problem?.row === row.id ? problem.text : errors[`photos_${i}`]}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-start justify-between gap-3 border-t pt-3">
                      <div className="grid gap-1">
                        <Checkbox name="genuine" value={row.id} checked={row.genuine} onChange={(e) => update(row.id, { genuine: e.target.checked })}>
                          This is a real customer&apos;s own words, and I haven&apos;t changed them
                        </Checkbox>
                        {errors[`genuine_${i}`] && (
                          <p role="alert" className="text-sm text-destructive">
                            {errors[`genuine_${i}`]}
                          </p>
                        )}
                      </div>
                      {!readOnly && (
                        <div className="flex items-center gap-0.5">
                          <Button type="button" variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`Move testimonial ${i + 1} up`}>
                            <ArrowUp />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            disabled={i === rows.length - 1}
                            onClick={() => move(i, i + 1)}
                            aria-label={`Move testimonial ${i + 1} down`}
                          >
                            <ArrowDown />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setRows((r) => r.filter((x) => x.id !== row.id))}
                            aria-label={`Remove testimonial ${i + 1}`}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}

            {!readOnly && (
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  disabled={rows.length >= MAX_TESTIMONIALS}
                  onClick={() => {
                    const id = crypto.randomUUID();
                    focusNext.current = id;
                    setRows((r) => [...r, { id, name: "", text: "", genuine: false, avatar: null, photos: [] }]);
                  }}
                >
                  <Plus aria-hidden /> Add a testimonial
                </Button>
                <p className="text-xs text-muted-foreground">
                  {rows.length >= MAX_TESTIMONIALS
                    ? `That's the most you can add (${MAX_TESTIMONIALS}).`
                    : `Up to ${MAX_TESTIMONIALS}. The page shows up to 6 reviews in all.`}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </SaveForm>
  );
}

// The customer's picture: a circle showing it, or their initial with an
// "Add picture" button. Optional; the page shows their initial without one.
function AvatarPicker({
  image,
  name,
  disabled,
  onPick,
  onRemove,
}: {
  image: Img | null;
  name: string;
  disabled: boolean;
  onPick: (files: FileList | null) => void;
  onRemove: () => void;
}) {
  const initial = name.trim().charAt(0).toUpperCase();
  return (
    <div className="grid justify-items-center gap-1.5 @lg:pt-6">
      <label
        className={cn(
          "group relative grid size-16 cursor-pointer place-items-center overflow-hidden rounded-full border bg-muted text-lg font-semibold text-muted-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
          disabled && "pointer-events-none",
        )}
        title={image ? "Change their picture" : "Add their picture (optional)"}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src(image)} alt="" className="size-full object-cover" />
        ) : initial ? (
          initial
        ) : (
          <UserRound className="size-6" aria-hidden />
        )}
        <span className="absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-center text-[10px] font-medium text-white opacity-0 transition group-hover:opacity-100">
          {image ? "Change" : "Add"}
        </span>
        <input
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          className="sr-only"
          aria-label={image ? "Change the customer's picture" : "Add the customer's picture (optional)"}
          disabled={disabled}
          onChange={(e) => {
            const input = e.currentTarget;
            void Promise.resolve(onPick(input.files)).finally(() => (input.value = ""));
          }}
        />
      </label>
      {image && !disabled ? (
        <button type="button" onClick={onRemove} className="text-xs text-muted-foreground underline-offset-2 hover:text-destructive hover:underline">
          Remove
        </button>
      ) : (
        <span className="text-xs text-muted-foreground">Picture</span>
      )}
    </div>
  );
}
