"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ExternalLink, ImagePlus, Plus, Trash2, Undo2 } from "lucide-react";
import { SIZE_CLASSES } from "@leadgen/core/booking/config";
import type { SaveState } from "@/app/app/[tenant]/pricing/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  GALLERY_MAX,
  poundsInput,
  serviceImageUrl,
  SIZES,
  slugify,
  type EditableService,
} from "@/lib/pricing-fields";
import { cn } from "@/lib/utils";
import { Check, DeleteButton, Field, FirstError, SaveForm, fieldClass, type Action, type Errors } from "./form-kit";

// The editor for one service's page: everything a customer reads about it
// before booking. Sections are anchors on one long form, so there is one Save
// and nothing is lost switching between them.

const SECTIONS = [
  { id: "basics", label: "Basics" },
  { id: "images", label: "Images" },
  { id: "details", label: "Page content" },
  { id: "how", label: "How it works" },
  { id: "faqs", label: "Questions" },
  { id: "pricing", label: "Pricing & sizes" },
  { id: "where", label: "Where & when" },
  { id: "search", label: "Search listing" },
] as const;

export function ServiceForm({
  service,
  action,
  deleteAction,
  readOnly,
  pageUrl,
}: {
  service?: EditableService;
  action: Action;
  deleteAction?: () => Promise<SaveState>;
  readOnly: boolean;
  // The service's address on the live booking site, when there is one.
  pageUrl: string | null;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[11rem_minmax(0,1fr)] lg:items-start">
      <nav aria-label="Sections" className="-mx-4 overflow-x-auto px-4 lg:sticky lg:top-4 lg:mx-0 lg:px-0">
        <ul className="flex gap-1 lg:flex-col">
          {SECTIONS.map((s) => (
            <li key={s.id} className="shrink-0">
              <a
                href={`#sec-${s.id}`}
                className="block rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <SaveForm
        action={action}
        readOnly={readOnly}
        sticky
        submitLabel={service ? "Save changes" : "Add service"}
        extra={
          <>
            {service && pageUrl && (
              <a href={pageUrl} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" })}>
                <ExternalLink /> View page
              </a>
            )}
            {service && deleteAction && <DeleteButton what={service.name} action={deleteAction} />}
          </>
        }
      >
        {(errors) => <Fields service={service} errors={errors} />}
      </SaveForm>
    </div>
  );
}

function Section({
  id,
  title,
  hint,
  children,
}: {
  id: (typeof SECTIONS)[number]["id"];
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={`sec-${id}`} aria-labelledby={`h-${id}`} className="scroll-mt-4 rounded-xl border bg-card">
      <header className="border-b px-4 py-3 sm:px-5">
        <h2 id={`h-${id}`} className="font-medium">
          {title}
        </h2>
        {hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}
      </header>
      <div className="grid gap-5 p-4 sm:p-5">{children}</div>
    </section>
  );
}

function Counter({ value, max }: { value: string; max: number }) {
  return (
    <span className={cn("text-xs tabular-nums", value.length > max ? "text-destructive" : "text-muted-foreground")}>
      {value.length}/{max}
    </span>
  );
}

function Fields({ service, errors }: { service?: EditableService; errors: Errors }) {
  const [name, setName] = useState(service?.name ?? "");
  // A new service's link name follows its name until the owner types their own.
  const [slug, setSlug] = useState(service?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(service));
  const [tagline, setTagline] = useState(service?.tagline ?? "");
  const [seoTitle, setSeoTitle] = useState(service?.seo_title ?? "");
  const [seoDescription, setSeoDescription] = useState(service?.seo_description ?? "");

  return (
    <div className="grid gap-6">
      <Section id="basics" title="Basics" hint="The headline details at the top of the service's page and in the booking list.">
        <div className="grid gap-4 sm:grid-cols-[1fr_9rem_9rem]">
          <Field label="Service name" name="name" error={errors.name}>
            <Input
              name="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
            />
          </Field>
          <Field label="Price from (£)" name="base_price" error={errors.base_price}>
            <Input name="base_price" inputMode="decimal" defaultValue={service ? poundsInput(service.base_price_pence) : ""} />
          </Field>
          <Field label="Takes (mins)" name="duration_mins" error={errors.duration_mins}>
            <Input name="duration_mins" inputMode="numeric" defaultValue={service?.duration_mins ?? 120} />
          </Field>
        </div>

        <Field label="Tagline" name="tagline" error={errors.tagline}>
          <Input
            name="tagline"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="One line that sells it, e.g. Our most popular full clean"
          />
        </Field>
        <div className="-mt-3 text-right">
          <Counter value={tagline} max={140} />
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
          <Field label="Link name" name="slug" error={errors.slug}>
            <Input
              name="slug"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              onBlur={() => setSlug((v) => slugify(v))}
              placeholder="full-valet"
              autoCapitalize="none"
              spellCheck={false}
            />
          </Field>
          <Field label="Badge" name="badge" error={errors.badge}>
            <Input name="badge" defaultValue={service?.badge ?? ""} placeholder="e.g. Most popular" />
          </Field>
        </div>
        <p className="-mt-3 text-xs text-muted-foreground">
          The page address ends <span className="font-mono">/services/{slug || "link-name"}</span>. Changing it breaks links
          you have already shared.
        </p>

        <Check name="active" label="Show on the booking page and the website" defaultChecked={service?.active ?? true} />
        <Field label="Order in lists" name="sort_order" error={errors.sort_order} className="w-28">
          <Input name="sort_order" inputMode="numeric" defaultValue={service?.sort_order ?? 0} />
        </Field>
      </Section>

      <Section id="images" title="Images" hint="A wide header image sets the tone. Gallery photos show your work.">
        <HeaderImage service={service} error={errors.image} />
        <Gallery service={service} error={errors.gallery} />
      </Section>

      <Section id="details" title="Page content" hint="What a customer reads to decide this is the one.">
        <Field label="Short description" name="description" error={errors.description}>
          <textarea
            name="description"
            rows={2}
            placeholder="A sentence or two. Shown on the booking list and under the page title."
            defaultValue={service?.description ?? ""}
            className={cn(fieldClass, "py-2")}
          />
        </Field>
        <Field label="About this service" name="body" error={errors.body}>
          <textarea
            name="body"
            rows={8}
            placeholder={"Tell the full story: what you do, why it matters, who it's for.\n\nLeave a blank line between paragraphs."}
            defaultValue={service?.body ?? ""}
            className={cn(fieldClass, "py-2")}
          />
        </Field>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="What's included (one per line)" name="includes" error={errors.includes}>
            <textarea
              name="includes"
              rows={7}
              placeholder={"Hand wash and dry\nWheels and arches cleaned\nInterior vacuum"}
              defaultValue={service?.includes?.join("\n") ?? ""}
              className={cn(fieldClass, "py-2")}
            />
          </Field>
          <Field label="What's not included (one per line)" name="not_included" error={errors.not_included}>
            <textarea
              name="not_included"
              rows={7}
              placeholder={"Paint correction\nEngine bay clean"}
              defaultValue={service?.not_included?.join("\n") ?? ""}
              className={cn(fieldClass, "py-2")}
            />
          </Field>
        </div>
      </Section>

      <Section id="how" title="How it works" hint="Steps, in order, so customers know what happens on the day.">
        <ListEditor
          name="steps"
          addLabel="Add a step"
          initial={service?.steps ?? []}
          blank={{ title: "", text: "" }}
          error={errors.steps}
          numbered
          fields={[
            { key: "title", label: "Step title", placeholder: "We arrive and set up" },
            { key: "text", label: "What happens", placeholder: "Short explanation", multiline: true },
          ]}
        />
      </Section>

      <Section id="faqs" title="Questions" hint="Answer what people ask before they book. Shown as an expandable list.">
        <ListEditor
          name="faqs"
          addLabel="Add a question"
          initial={service?.faqs ?? []}
          blank={{ q: "", a: "" }}
          error={errors.faqs}
          fields={[
            { key: "q", label: "Question", placeholder: "Do you need access to water or power?" },
            { key: "a", label: "Answer", placeholder: "Your answer", multiline: true },
          ]}
        />
      </Section>

      <Section id="pricing" title="Pricing & sizes" hint="Extra price and time for bigger vehicles, on top of the starting price.">
        <fieldset className="grid gap-2">
          <legend className="sr-only">Extra for bigger vehicles</legend>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Size</th>
                  <th className="px-3 py-2 font-medium">Add (£)</th>
                  <th className="px-3 py-2 font-medium">Extra mins</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {SIZES.map((size) => {
                  const adj = service?.size_adjustments[size];
                  return (
                    <tr key={size}>
                      <td className="px-3 py-2">{SIZE_CLASSES[size].split(":")[0]}</td>
                      <td className="px-3 py-1.5">
                        <Input
                          name={`size_${size}_price`}
                          inputMode="decimal"
                          placeholder="0"
                          aria-label={`${size} extra price`}
                          aria-invalid={errors[`size_${size}_price`] ? true : undefined}
                          defaultValue={adj?.price_pence ? poundsInput(adj.price_pence) : ""}
                          className="w-24"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <Input
                          name={`size_${size}_mins`}
                          inputMode="numeric"
                          placeholder="0"
                          aria-label={`${size} extra minutes`}
                          aria-invalid={errors[`size_${size}_mins`] ? true : undefined}
                          defaultValue={adj?.extra_mins || ""}
                          className="w-24"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <FirstError errors={errors} prefix="size_" />
        </fieldset>
      </Section>

      <Section id="where" title="Where & when" hint="Where this service can be done.">
        <fieldset className="grid gap-2">
          <legend className="sr-only">Can be done</legend>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Check name="location_mobile" label="At the customer's" defaultChecked={service?.location_types.includes("mobile") ?? true} />
            <Check name="location_unit" label="At your unit" defaultChecked={service?.location_types.includes("unit") ?? true} />
          </div>
          {errors.location_mobile && <p className="text-sm text-destructive">{errors.location_mobile}</p>}
        </fieldset>
      </Section>

      <Section id="search" title="Search listing" hint="How the page appears on Google and when shared. Leave blank to use the name and short description.">
        <Field label="Page title" name="seo_title" error={errors.seo_title}>
          <Input name="seo_title" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder={name || "Page title"} />
        </Field>
        <div className="-mt-3 text-right">
          <Counter value={seoTitle} max={70} />
        </div>
        <Field label="Page summary" name="seo_description" error={errors.seo_description}>
          <textarea
            name="seo_description"
            rows={3}
            value={seoDescription}
            onChange={(e) => setSeoDescription(e.target.value)}
            className={cn(fieldClass, "py-2")}
          />
        </Field>
        <div className="-mt-3 text-right">
          <Counter value={seoDescription} max={160} />
        </div>
        <div className="rounded-lg bg-muted/50 p-3" aria-label="Search result preview">
          <p className="truncate text-base text-blue-700 dark:text-blue-400">{seoTitle || name || "Page title"}</p>
          <p className="truncate text-xs text-emerald-700 dark:text-emerald-400">/services/{slug || "link-name"}</p>
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {seoDescription || tagline || "Your page summary appears here."}
          </p>
        </div>
      </Section>
    </div>
  );
}

// ------------------------------------------------------------------ images

// An object URL for a chosen file, released when it changes or goes away.
function useObjectUrl(file: File | null | undefined) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  return url;
}

function HeaderImage({ service, error }: { service?: EditableService; error?: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [remove, setRemove] = useState(false);
  const chosen = useObjectUrl(file);
  const current = remove ? null : serviceImageUrl(service?.image_path);
  const shown = chosen ?? current;
  const id = useId();

  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        Header image
      </label>
      <div className="aspect-[16/7] w-full max-w-xl overflow-hidden rounded-xl border bg-muted">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1 text-sm text-muted-foreground">
            <ImagePlus className="size-6" aria-hidden />
            No header image yet
          </div>
        )}
      </div>
      <Input
        id={id}
        name="image"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-invalid={error ? true : undefined}
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          setRemove(false);
        }}
        className="max-w-xl"
      />
      <p className="text-xs text-muted-foreground">JPG, PNG or WebP, up to 5 MB. Landscape works best (about 16:7).</p>
      {service?.image_path && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="remove_image"
            checked={remove}
            onChange={(e) => setRemove(e.target.checked)}
            className="size-4 accent-primary"
          />
          Remove the current image
        </label>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function Gallery({ service, error }: { service?: EditableService; error?: string }) {
  const saved = service?.gallery ?? [];
  const [keep, setKeep] = useState<string[]>(saved);
  const [files, setFiles] = useState<File[]>([]);
  const room = GALLERY_MAX - keep.length;
  const id = useId();

  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        Gallery <span className="font-normal text-muted-foreground">({keep.length + files.length} of {GALLERY_MAX})</span>
      </label>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {saved.map((path) => {
          const kept = keep.includes(path);
          return (
            <li key={path} className="relative overflow-hidden rounded-lg border bg-muted">
              {kept && <input type="hidden" name="gallery_keep" value={path} />}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={serviceImageUrl(path)!} alt="" className={cn("aspect-[4/3] w-full object-cover", !kept && "opacity-30")} />
              <Button
                type="button"
                size="icon-sm"
                variant="secondary"
                aria-label={kept ? "Remove this photo" : "Keep this photo"}
                className="absolute top-1.5 right-1.5"
                onClick={() => setKeep((k) => (kept ? k.filter((p) => p !== path) : [...k, path]))}
              >
                {kept ? <Trash2 /> : <Undo2 />}
              </Button>
            </li>
          );
        })}
        {files.map((file, i) => (
          <NewPhoto key={`${file.name}-${file.lastModified}-${i}`} file={file} onRemove={() => setFiles((f) => f.filter((x) => x !== file))} />
        ))}
      </ul>
      {/* The chosen files are mirrored into a real input so they post with the form. */}
      <FilesInput id={id} files={files} onPick={(picked) => setFiles((f) => [...f, ...picked].slice(0, Math.max(room, 0)))} disabled={room - files.length <= 0} />
      <p className="text-xs text-muted-foreground">Up to {GALLERY_MAX} photos, 5 MB each. They show in the order above.</p>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function NewPhoto({ file, onRemove }: { file: File; onRemove: () => void }) {
  const url = useObjectUrl(file);
  return (
    <li className="relative overflow-hidden rounded-lg border bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && <img src={url} alt="" className="aspect-[4/3] w-full object-cover" />}
      <span className="absolute bottom-1.5 left-1.5 rounded bg-background/90 px-1.5 py-0.5 text-xs">New</span>
      <Button type="button" size="icon-sm" variant="secondary" aria-label="Remove this photo" className="absolute top-1.5 right-1.5" onClick={onRemove}>
        <Trash2 />
      </Button>
    </li>
  );
}

// A visible picker that adds to a list, plus a hidden input that carries the
// whole list in the form post.
function FilesInput({
  id,
  files,
  onPick,
  disabled,
}: {
  id: string;
  files: File[];
  onPick: (files: File[]) => void;
  disabled: boolean;
}) {
  const mirror = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const input = mirror.current;
    if (!input) return;
    const transfer = new DataTransfer();
    for (const f of files) transfer.items.add(f);
    input.files = transfer.files;
  }, [files]);

  return (
    <>
      <Input
        id={id}
        type="file"
        multiple
        disabled={disabled}
        accept="image/jpeg,image/png,image/webp"
        className="max-w-xl"
        onChange={(e) => {
          onPick(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <input ref={mirror} type="file" name="gallery_new" multiple hidden />
    </>
  );
}

// ------------------------------------------------------------------ lists

type ListField = { key: string; label: string; placeholder?: string; multiline?: boolean };

// A reorderable list of small records (steps, questions), posted as one JSON field.
function ListEditor<T extends Record<string, string>>({
  name,
  initial,
  blank,
  fields,
  addLabel,
  numbered,
  error,
}: {
  name: string;
  initial: T[];
  blank: T;
  fields: ListField[];
  addLabel: string;
  numbered?: boolean;
  error?: string;
}) {
  // Rows carry a stable id so reordering keeps each row's focus and typing.
  const [rows, setRows] = useState(() => initial.map((value, i) => ({ id: i, value })));
  const [nextId, setNextId] = useState(initial.length);

  const update = (id: number, key: string, text: string) =>
    setRows((r) => r.map((row) => (row.id === id ? { ...row, value: { ...row.value, [key]: text } } : row)));
  const move = (index: number, by: -1 | 1) =>
    setRows((r) => {
      const copy = [...r];
      [copy[index], copy[index + by]] = [copy[index + by], copy[index]];
      return copy;
    });

  return (
    <div className="grid gap-3">
      <input type="hidden" name={name} value={JSON.stringify(rows.map((r) => r.value))} />
      {rows.length === 0 && <p className="text-sm text-muted-foreground">Nothing here yet.</p>}
      <ol className="grid gap-3">
        {rows.map((row, i) => (
          <li key={row.id} className="grid gap-3 rounded-lg border bg-background p-3 sm:grid-cols-[1fr_auto]">
            <div className="grid gap-3">
              {fields.map((f) => (
                <div key={f.key} className="grid gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    {numbered && f === fields[0] ? `${i + 1}. ` : ""}
                    {f.label}
                  </label>
                  {f.multiline ? (
                    <textarea
                      rows={2}
                      value={row.value[f.key]}
                      placeholder={f.placeholder}
                      onChange={(e) => update(row.id, f.key, e.target.value)}
                      className={cn(fieldClass, "py-2")}
                    />
                  ) : (
                    <Input value={row.value[f.key]} placeholder={f.placeholder} onChange={(e) => update(row.id, f.key, e.target.value)} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-1 sm:flex-col">
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Move down" disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Delete"
                className="text-destructive"
                onClick={() => setRows((r) => r.filter((x) => x.id !== row.id))}
              >
                <Trash2 />
              </Button>
            </div>
          </li>
        ))}
      </ol>
      <Button
        type="button"
        variant="outline"
        className="justify-self-start"
        onClick={() => {
          setRows((r) => [...r, { id: nextId, value: { ...blank } }]);
          setNextId((n) => n + 1);
        }}
      >
        <Plus /> {addLabel}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
