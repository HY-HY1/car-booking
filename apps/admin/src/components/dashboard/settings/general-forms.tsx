"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { RefreshCw, Star, Trash2 } from "lucide-react";
import { BUTTON_POSITIONS, TIMEZONES, TRADES } from "@leadgen/core/settings/forms";
import type { Branding } from "@leadgen/core/tenants";
import { readableOn as textOn } from "@leadgen/core/branding/colors";
import {
  checkDomainAction,
  makePrimaryDomainAction,
  removeDomainAction,
  type DomainCheckState,
} from "@/app/app/[tenant]/settings/actions";
import { CopyText } from "@/components/platform/copy-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES, shrinkImage } from "@/lib/shrink-image";
import { cn } from "@/lib/utils";
import { Field, SaveForm, type Action } from "../form-kit";
import { BookingPagePreview, type PreviewService } from "./booking-page-preview";
import { CENTRE, CoverPositioner } from "./cover-position";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { askToConfirm } from "@/components/ui/confirm-dialog";

// Settings → Business details and → Booking page.

export type GeneralValues = {
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  trade: string;
  timezone: string;
  vat_number: string | null;
};

export function GeneralForm({ values, action, readOnly }: { values: GeneralValues; action: Action; readOnly: boolean }) {
  const [vat, setVat] = useState(!!values.vat_number);
  return (
    <SaveForm action={action} readOnly={readOnly}>
      {(errors) => (
        <>
          <div className="grid gap-4 @lg:grid-cols-2">
            <Field label="Business name" name="name" error={errors.name}>
              <Input name="name" defaultValue={values.name} autoComplete="organization" maxLength={100} />
            </Field>
            <Field label="What you do" name="trade" error={errors.trade}>
              <Select name="trade" defaultValue={values.trade}>
                {Object.entries(TRADES).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Contact email" name="contact_email" error={errors.contact_email} hint="Shown to customers.">
              <Input
                name="contact_email"
                type="email"
                inputMode="email"
                autoComplete="email"
                defaultValue={values.contact_email ?? ""}
                placeholder="e.g. hello@yourbusiness.co.uk"
              />
            </Field>
            <Field label="Contact phone" name="contact_phone" error={errors.contact_phone} hint="Shown to customers.">
              <Input
                name="contact_phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                defaultValue={values.contact_phone ?? ""}
                placeholder="e.g. 07700 900123"
              />
            </Field>
            <Field label="Time zone" name="timezone" error={errors.timezone} hint="Your hours, the diary and every time customers see.">
              <Select name="timezone" defaultValue={values.timezone}>
                {Object.entries(TIMEZONES).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid content-start gap-2">
              <p className="text-sm font-medium">Currency</p>
              <p className="flex h-11 items-center rounded-lg border border-dashed px-2.5 text-sm text-muted-foreground">
                Pounds sterling (£)
              </p>
            </div>
          </div>
          <div className="grid gap-3 rounded-lg border p-4">
            <Switch
              name="vat_registered"
              checked={vat}
              onChange={(e) => setVat(e.target.checked)}
              description="Your prices are shown to customers exactly as you enter them, so include VAT in them if you charge it."
            >
              VAT registered
            </Switch>
            {vat && (
              <Field label="VAT number" name="vat_number" error={errors.vat_number} className="max-w-xs">
                <Input name="vat_number" defaultValue={values.vat_number ?? ""} placeholder="e.g. GB123456789" autoComplete="off" />
              </Field>
            )}
          </div>
        </>
      )}
    </SaveForm>
  );
}

// ------------------------------------------------------------ Booking page

export function BrandingForm({
  branding,
  businessName,
  contact,
  services,
  action,
  readOnly,
}: {
  branding: Branding;
  businessName: string;
  contact: { email: string | null; phone: string | null };
  services: PreviewService[];
  action: Action;
  readOnly: boolean;
}) {
  const [primary, setPrimary] = useState(branding.primary_color);
  const [accent, setAccent] = useState(branding.accent_color);
  const [secondary, setSecondary] = useState(branding.secondary_color ?? "");
  const [label, setLabel] = useState(branding.button_label ?? "");
  const [position, setPosition] = useState(branding.button_position);
  const [tagline, setTagline] = useState(branding.tagline ?? "");
  // A newly picked image, and whether the saved one is being taken off.
  const [logo, setLogo] = useState<PickedImage>(UNPICKED);
  const [cover, setCover] = useState<PickedImage>(UNPICKED);
  // Bumped after a save so the file pickers start empty again: a picked file
  // left in one would be uploaded again with every later save.
  const [generation, setGeneration] = useState(0);
  const shown = (image: PickedImage, saved?: string) => image.picked ?? (image.removed ? undefined : saved);
  const coverSrc = shown(cover, branding.cover_url);
  // Where the cover sits in its banner; a new picture starts in the middle.
  const [coverPosition, setCoverPosition] = useState(branding.cover_position ?? CENTRE);

  return (
    <SaveForm
      action={action}
      readOnly={readOnly}
      sticky
      onSaved={() => {
        setLogo(UNPICKED);
        setCover(UNPICKED);
        setGeneration((g) => g + 1);
      }}
    >
      {(errors) => (
        <div className="grid gap-8 @4xl:grid-cols-[minmax(0,1fr)_20rem] @4xl:items-start">
          <div className="grid gap-8">
            <Group title="Colours" note="Each is adjusted so it stays clear in light and dark mode.">
              <div className="grid gap-4 @lg:grid-cols-3">
                <ColourField
                  label="Main colour"
                  name="primary_color"
                  value={primary}
                  onChange={setPrimary}
                  error={errors.primary_color}
                  hint="Booking page header and dashboard buttons."
                />
                <ColourField
                  label="Accent colour"
                  name="accent_color"
                  value={accent}
                  onChange={setAccent}
                  error={errors.accent_color}
                  hint="Booking buttons and your charts."
                />
                <ColourField
                  label="Menu highlight"
                  name="secondary_color"
                  value={secondary}
                  onChange={setSecondary}
                  error={errors.secondary_color}
                  placeholder="Optional"
                  hint="Blank uses the main colour."
                />
              </div>
            </Group>

            <Group title="Words and links">
              <Field label="Tagline" name="tagline" error={errors.tagline} hint="Under your name at the top of the booking page.">
                <Input
                  name="tagline"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="e.g. Mobile valeting across Bristol"
                  maxLength={120}
                />
              </Field>
              <div className="grid gap-4 @lg:grid-cols-2">
                <Field
                  label="Your website"
                  name="website_url"
                  error={errors.website_url}
                  hint="Linked in the booking page's header and footer. Blank hides the link."
                >
                  <Input
                    name="website_url"
                    type="url"
                    inputMode="url"
                    defaultValue={branding.website_url ?? ""}
                    placeholder="e.g. yourbusiness.co.uk"
                  />
                </Field>
                <Field
                  label="Your terms and conditions"
                  name="terms_url"
                  error={errors.terms_url}
                  hint="Optional. Blank uses terms made from your deposit and cancellation settings."
                >
                  <Input
                    name="terms_url"
                    type="url"
                    inputMode="url"
                    defaultValue={branding.terms_url ?? ""}
                    placeholder="e.g. yourbusiness.co.uk/terms"
                  />
                </Field>
              </div>
            </Group>

            <Group title="Images" note="JPG, PNG or WebP. Large images are made smaller before they're sent.">
              <div className="grid gap-4 @lg:grid-cols-2">
                <ImageField
                  key={`logo-${generation}`}
                  label="Logo"
                  name="logo"
                  current={branding.logo_url}
                  error={errors.logo}
                  onChange={setLogo}
                />
                <ImageField
                  key={`cover-${generation}`}
                  label="Cover image"
                  name="cover"
                  current={branding.cover_url}
                  error={errors.cover}
                  onChange={(image) => {
                    if (image.picked !== cover.picked) setCoverPosition(image.picked ? CENTRE : (branding.cover_position ?? CENTRE));
                    setCover(image);
                  }}
                  wide
                />
              </div>
              {coverSrc && (
                <CoverPositioner src={coverSrc} value={coverPosition} onChange={setCoverPosition} disabled={readOnly} />
              )}
            </Group>

            <Group title="Button on your website" note="Added by the code under Add booking to your website, below.">
              <div className="grid gap-4 @lg:grid-cols-2">
                <Field label="Button text" name="button_label" error={errors.button_label}>
                  <Input
                    name="button_label"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="Instant quote"
                    maxLength={30}
                  />
                </Field>
                <fieldset className="grid content-start gap-2">
                  <legend className="mb-2 text-sm font-medium">Where it sits</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(BUTTON_POSITIONS).map(([k, l]) => (
                      <label
                        key={k}
                        className="flex h-11 cursor-pointer items-center justify-center rounded-lg border text-sm font-medium has-checked:border-primary has-checked:bg-primary/10 has-focus-visible:ring-3 has-focus-visible:ring-ring/50 has-disabled:cursor-not-allowed has-disabled:opacity-60"
                      >
                        <input
                          type="radio"
                          name="button_position"
                          value={k}
                          checked={position === k}
                          onChange={() => setPosition(k as typeof position)}
                          className="sr-only"
                        />
                        {l}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
              <div
                className="relative h-28 overflow-hidden rounded-lg border bg-muted/40"
                role="img"
                aria-label="Preview of the button on your website"
              >
                <div className="space-y-2 p-3">
                  <div className="h-2 w-1/3 rounded bg-muted-foreground/20" />
                  <div className="h-2 w-2/3 rounded bg-muted-foreground/15" />
                  <div className="h-2 w-1/2 rounded bg-muted-foreground/15" />
                </div>
                <span
                  className={cn(
                    "absolute bottom-3 rounded-full px-4 py-2 text-sm font-semibold shadow-lg",
                    position === "left" ? "left-3" : "right-3",
                  )}
                  style={{ background: colourOr(primary, "#18181b"), color: readableOn(primary) }}
                >
                  {label.trim() || "Instant quote"}
                </span>
              </div>
            </Group>
          </div>
          <div className="@4xl:sticky @4xl:top-6">
            <BookingPagePreview
              businessName={businessName}
              primary={primary}
              accent={accent}
              tagline={tagline}
              logoUrl={shown(logo, branding.logo_url)}
              coverUrl={coverSrc}
              coverPosition={coverPosition}
              contact={contact}
              services={services}
            />
          </div>
        </div>
      )}
    </SaveForm>
  );
}

type PickedImage = { picked: string | null; removed: boolean };
const UNPICKED: PickedImage = { picked: null, removed: false };

// A titled group of fields inside a card.
function Group({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid min-w-0 gap-4">
      <legend className="mb-3 grid gap-0.5">
        <span className="text-sm font-semibold">{title}</span>
        {note && <span className="text-sm text-muted-foreground">{note}</span>}
      </legend>
      {children}
    </fieldset>
  );
}

const colourOr = (value: string, fallback: string) => (/^#[0-9a-f]{6}$/i.test(value) ? value : fallback);

function ColourField({
  label,
  name,
  value,
  onChange,
  error,
  placeholder,
  hint,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  // Set for an optional colour, which can be left blank.
  placeholder?: string;
  hint?: string;
}) {
  const id = `${name}-${useId()}`;
  const described = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="grid content-start gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : placeholder ? "#e4e4e7" : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`Pick the ${label.toLowerCase()}`}
          className="size-11 shrink-0 cursor-pointer rounded-lg border bg-transparent p-1"
        />
        <Input
          id={id}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono"
          maxLength={7}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={described}
        />
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

function ImageField({
  label,
  name,
  current,
  error,
  wide,
  onChange,
}: {
  label: string;
  name: string;
  current?: string;
  error?: string;
  wide?: boolean;
  // For the preview: the image picked but not saved yet, and "Remove".
  onChange: (image: { picked: string | null; removed: boolean }) => void;
}) {
  const [problem, setProblem] = useState<string>();
  const [shrinking, setShrinking] = useState(false);
  const previewUrl = useRef<string | null>(null);
  const removed = useRef(false);
  const [removing, setRemoving] = useState(false);
  // The preview's copy of a picked file goes with the field.
  useEffect(
    () => () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    },
    [],
  );

  function showInPreview(file?: File) {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = file ? URL.createObjectURL(file) : null;
    onChange({ picked: previewUrl.current, removed: removed.current });
  }

  // The chosen file is shrunk straight away and swapped into the input, so
  // what Save sends fits through the host's request limit (lib/shrink-image.ts).
  async function choose(input: HTMLInputElement) {
    setProblem(undefined);
    const file = input.files?.[0];
    if (!file) return showInPreview();
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      input.value = "";
      setProblem("Use a JPG, PNG or WebP image. For an SVG logo, save it as a PNG first.");
      return showInPreview();
    }
    setShrinking(true);
    try {
      const small = await shrinkImage(file, wide ? 2400 : 800);
      const files = new DataTransfer();
      files.items.add(small);
      input.files = files.files;
    } catch {
      // Couldn't redraw it: send the original and let the size check decide.
    } finally {
      setShrinking(false);
    }
    if ((input.files?.[0]?.size ?? 0) > MAX_UPLOAD_BYTES) {
      input.value = "";
      setProblem("That image is too large even after shrinking. Try a smaller one.");
    }
    showInPreview(input.files?.[0]);
  }

  return (
    <div className="grid content-start gap-2">
      <Field label={label} name={name} error={problem ?? error}>
        <Input
          name={name}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          onChange={(e) => void choose(e.currentTarget)}
          aria-busy={shrinking || undefined}
        />
      </Field>
      {shrinking && <p className="text-xs text-muted-foreground">Preparing the image…</p>}
      {current && (
        <div className="flex items-center gap-3 rounded-lg border p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current}
            alt={`Current ${label.toLowerCase()}`}
            className={cn(
              "h-12 w-24 rounded bg-muted",
              wide ? "object-cover" : "object-contain",
              removing && "opacity-40",
            )}
          />
          <Checkbox
            name={`remove_${name}`}
            labelClassName={cn(removing && "text-destructive")}
            onChange={(e) => {
              removed.current = e.target.checked;
              setRemoving(e.target.checked);
              onChange({ picked: previewUrl.current, removed: e.target.checked });
            }}
          >
            {removing ? "Removed when you save" : `Remove this ${label.toLowerCase()}`}
          </Checkbox>
        </div>
      )}
    </div>
  );
}

// Black or white text, by the same rule as the booking page and dashboard;
// white while a half-typed colour isn't one yet.
function readableOn(hex: string) {
  return /^#[0-9a-f]{6}$/i.test(hex) ? textOn(hex) : "#ffffff";
}

// ------------------------------------------------------------- Custom domains

export type DomainView = {
  id: string;
  hostname: string;
  url: string;
  verified: boolean;
  isPrimary: boolean;
  // The free address (/booking/<slug> or <slug>.domain.com): always there,
  // not a domain row, so nothing here can change it.
  isFallback: boolean;
  checkError: string | null;
  records: { type: string; host: string; fullName: string; value: string }[];
};

export function DomainRow({ slug, domain, readOnly }: { slug: string; domain: DomainView; readOnly: boolean }) {
  const [pending, startTransition] = useTransition();
  const [check, setCheck] = useState<DomainCheckState | null>(null);
  const problems = check?.problems ?? (domain.checkError ? [domain.checkError] : []);

  const run = (fn: () => Promise<{ message?: string }>, done: string) =>
    startTransition(async () => {
      const { message } = await fn();
      if (message) toast.error(message);
      else toast.success(done);
    });

  return (
    <li className="grid gap-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid min-w-0 gap-1.5">
          <a
            href={domain.url}
            target="_blank"
            rel="noreferrer"
            className="truncate font-mono text-sm font-medium underline-offset-4 hover:underline"
          >
            {domain.hostname}
          </a>
          <div className="flex flex-wrap gap-1.5">
            {domain.isPrimary && <Badge tone="info">Main address</Badge>}
            <Badge>{domain.isFallback ? "Free address" : "Your domain"}</Badge>
            <Badge tone={domain.verified ? "success" : "warning"}>{domain.verified ? "Live" : "Waiting for DNS"}</Badge>
          </div>
        </div>
        {!readOnly && !domain.isFallback && (
          <div className="flex flex-wrap gap-2">
            {!domain.verified && (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const r = await checkDomainAction(slug, domain.id);
                    setCheck(r);
                    if (r.message) toast.error(r.message);
                    else if (r.ok) toast.success("Connected. Your booking page is live at this address");
                    else toast.error("Not connected yet. Check the records below.");
                  })
                }
              >
                <RefreshCw /> {pending ? "Checking…" : "Check DNS"}
              </Button>
            )}
            {domain.verified && !domain.isPrimary && (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => run(() => makePrimaryDomainAction(slug, domain.id), "Main address changed")}
              >
                <Star /> Make main address
              </Button>
            )}
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={async () => {
                const after = domain.isPrimary ? " Your booking page goes back to its free address." : "";
                const confirmed = await askToConfirm({
                  title: `Disconnect ${domain.hostname}?`,
                  description: `Customers using it will stop reaching your booking page.${after}`,
                  confirmLabel: "Disconnect",
                  destructive: true,
                });
                if (confirmed) run(() => removeDomainAction(slug, domain.id), "Address disconnected");
              }}
            >
              <Trash2 /> Disconnect
            </Button>
          </div>
        )}
      </div>

      {!domain.verified && domain.records.length > 0 && (
        <DnsRecords
          intro="Add these records where you manage your domain's DNS (your domain registrar, or Cloudflare), then press Check DNS. Changes can take up to an hour to show."
          records={domain.records}
        />
      )}

      {!domain.verified && problems.length > 0 && !check?.ok && (
        <ul className="grid gap-1 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
    </li>
  );
}

// DNS records to add, one block each, so they read as well on a phone as on
// a computer. Shared with the email sending address (sender-card.tsx).
export function DnsRecords({
  intro,
  records,
}: {
  intro: string;
  records: { type: string; host: string; fullName: string; value: string; priority?: number | null }[];
}) {
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">{intro}</p>
      <ol className="grid gap-2">
        {records.map((r, i) => (
          <li key={`${r.type}-${r.fullName}-${i}`} className="grid gap-2 rounded-lg bg-muted/50 p-3 text-sm">
            <p className="flex flex-wrap items-center gap-2">
              <Badge>{r.type}</Badge>
              <span className="text-muted-foreground">{r.fullName}</span>
              {r.priority != null && <span className="text-muted-foreground">· priority {r.priority}</span>}
            </p>
            <div className="grid gap-2 @lg:grid-cols-[8rem_minmax(0,1fr)] @lg:items-center">
              <span className="text-xs font-medium text-muted-foreground">Name / host</span>
              <CopyText value={r.host} label={`${r.type} name`} />
              <span className="text-xs font-medium text-muted-foreground">Value</span>
              <CopyText value={r.value} label={`${r.type} value`} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function AddDomainForm({ action }: { action: Action }) {
  return (
    <SaveForm action={action} submitLabel="Add address" resetOnSave savedText="Added. Now add the DNS records shown.">
      {(errors) => (
        <Field
          label="Use your own address"
          name="hostname"
          error={errors.hostname}
          hint="A subdomain of your website works best, like book.yourbusiness.co.uk."
          className="max-w-md"
        >
          <Input name="hostname" placeholder="e.g. book.yourbusiness.co.uk" autoComplete="off" autoCapitalize="none" spellCheck={false} />
        </Field>
      )}
    </SaveForm>
  );
}
