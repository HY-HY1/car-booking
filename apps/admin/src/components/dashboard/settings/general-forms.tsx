"use client";

import { useId, useRef, useState, useTransition } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES, shrinkImage } from "@/lib/shrink-image";
import { cn } from "@/lib/utils";
import { Field, SaveForm, type Action } from "../form-kit";
import { BookingPagePreview, type PreviewService } from "./booking-page-preview";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/toast";
import { askToConfirm } from "@/components/ui/confirm-dialog";

// Settings → General and → Booking page.

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
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Business name" name="name" error={errors.name}>
              <Input name="name" defaultValue={values.name} autoComplete="organization" />
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
            <Field label="Contact email (shown to customers)" name="contact_email" error={errors.contact_email}>
              <Input name="contact_email" type="email" defaultValue={values.contact_email ?? ""} placeholder="hello@yourbusiness.co.uk" />
            </Field>
            <Field label="Contact phone (shown to customers)" name="contact_phone" error={errors.contact_phone}>
              <Input name="contact_phone" type="tel" defaultValue={values.contact_phone ?? ""} placeholder="07700 900123" />
            </Field>
            <Field label="Time zone" name="timezone" error={errors.timezone}>
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
              <p className="flex h-8 items-center text-sm text-muted-foreground">Pounds sterling (£)</p>
            </div>
          </div>
          <div className="grid gap-3">
            <Checkbox
              name="vat_registered"
              checked={vat}
              onChange={(e) => setVat(e.target.checked)}
            >
              VAT registered
            </Checkbox>
            {vat && (
              <Field label="VAT number" name="vat_number" error={errors.vat_number} className="max-w-xs">
                <Input name="vat_number" defaultValue={values.vat_number ?? ""} placeholder="GB123456789" autoComplete="off" />
              </Field>
            )}
            <p className="text-xs text-muted-foreground">
              Your prices are shown to customers exactly as you enter them, so include VAT in them if you charge it.
            </p>
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
  const [logo, setLogo] = useState<{ picked: string | null; removed: boolean }>({ picked: null, removed: false });
  const [cover, setCover] = useState<{ picked: string | null; removed: boolean }>({ picked: null, removed: false });
  const shown = (image: typeof logo, saved?: string) => image.picked ?? (image.removed ? undefined : saved);

  return (
    <SaveForm action={action} readOnly={readOnly}>
      {(errors) => (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
        <div className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <ColourField label="Main colour" name="primary_color" value={primary} onChange={setPrimary} error={errors.primary_color} />
            <ColourField label="Accent colour" name="accent_color" value={accent} onChange={setAccent} error={errors.accent_color} />
            <ColourField
              label="Secondary colour (optional)"
              name="secondary_color"
              value={secondary}
              onChange={setSecondary}
              error={errors.secondary_color}
              placeholder="None"
            />
            <p className="self-end text-xs text-muted-foreground">
              Main: the booking page header and your dashboard&apos;s buttons. Accent: booking buttons and your charts.
              Secondary: the selected item in your dashboard menu (the main colour if left blank). Each is adjusted for light and dark mode.
            </p>
            <Field label="Tagline" name="tagline" error={errors.tagline} className="sm:col-span-2">
              <Input name="tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Mobile valeting across Bristol" maxLength={120} />
            </Field>
            <Field label="Your website" name="website_url" error={errors.website_url} className="sm:col-span-2">
              <Input name="website_url" defaultValue={branding.website_url ?? ""} placeholder="https://yourbusiness.co.uk" />
            </Field>
            <Field
              label="Your terms and conditions (optional)"
              name="terms_url"
              error={errors.terms_url}
              hint="Linked when customers book. Leave it blank to use terms made from your deposit and cancellation settings."
              className="sm:col-span-2"
            >
              <Input name="terms_url" defaultValue={branding.terms_url ?? ""} placeholder="https://yourbusiness.co.uk/terms" />
            </Field>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            The booking page shows a &ldquo;Back to website&rdquo; link to your website. Leave it blank to hide the link.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <ImageField label="Logo" name="logo" current={branding.logo_url} error={errors.logo} onChange={setLogo} />
            <ImageField label="Cover image" name="cover" current={branding.cover_url} error={errors.cover} onChange={setCover} wide />
          </div>

          <fieldset className="grid gap-3 rounded-xl border p-4">
            <legend className="px-1 text-sm font-medium">Button on your website</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Button text" name="button_label" error={errors.button_label}>
                <Input name="button_label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Instant quote" maxLength={30} />
              </Field>
              <Field label="Where it sits" name="button_position">
                <Select
                  name="button_position"
                  value={position}
                  onChange={(e) => setPosition(e.target.value as typeof position)}
                >
                  {Object.entries(BUTTON_POSITIONS).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="relative h-28 overflow-hidden rounded-lg border bg-muted/40" aria-label="Preview of the website button">
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
                style={{ background: primary, color: readableOn(primary) }}
              >
                {label.trim() || "Instant quote"}
              </span>
            </div>
          </fieldset>
        </div>
        <div className="xl:sticky xl:top-4">
          <BookingPagePreview
            businessName={businessName}
            primary={primary}
            accent={accent}
            tagline={tagline}
            logoUrl={shown(logo, branding.logo_url)}
            coverUrl={shown(cover, branding.cover_url)}
            contact={contact}
            services={services}
          />
        </div>
        </div>
      )}
    </SaveForm>
  );
}

function ColourField({
  label,
  name,
  value,
  onChange,
  error,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  // Set for an optional colour, which can be left blank.
  placeholder?: string;
}) {
  const id = `${name}-${useId()}`;
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
          aria-describedby={error ? `${id}-error` : undefined}
        />
      </div>
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
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
      {current && (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current}
            alt={`Current ${label.toLowerCase()}`}
            className={cn("rounded border", wide ? "h-12 w-24 object-cover" : "h-12 w-24 object-contain")}
          />
          <Checkbox
            name={`remove_${name}`}
            onChange={(e) => {
              removed.current = e.target.checked;
              onChange({ picked: previewUrl.current, removed: e.target.checked });
            }}
          >
            Remove
          </Checkbox>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {shrinking ? "Preparing the image…" : "JPG, PNG or WebP. Large images are made smaller before they're sent."}
      </p>
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
    <li className="grid gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <a href={domain.url} target="_blank" rel="noreferrer" className="truncate font-mono text-sm underline-offset-4 hover:underline">
            {domain.hostname}
          </a>
          <p className="text-xs text-muted-foreground">
            {[
              domain.isPrimary && "Main address",
              domain.isFallback ? "Free address" : "Your domain",
              domain.verified ? "Live" : "Waiting for DNS",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            {!domain.verified && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const r = await checkDomainAction(slug, domain.id);
                    setCheck(r);
                    if (r.message) toast.error(r.message);
                    else if (r.ok) toast.success("Connected. Your booking page is live at this address");
                  })
                }
              >
                <RefreshCw /> {pending ? "Checking…" : "Check DNS"}
              </Button>
            )}
            {domain.verified && !domain.isPrimary && !domain.isFallback && (
              <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => run(() => makePrimaryDomainAction(slug, domain.id), "Main address changed")}>
                <Star /> Make main address
              </Button>
            )}
            {!domain.isFallback && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive"
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
                <Trash2 /> Remove
              </Button>
            )}
          </div>
        )}
      </div>

      {!domain.verified && domain.records.length > 0 && (
        <div className="grid gap-2 text-sm">
          <p className="text-muted-foreground">
            Add these two records where you manage your domain&apos;s DNS (your domain registrar, or Cloudflare), then press
            Check DNS. Changes can take up to an hour to show.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-1 pr-3 font-medium">Type</th>
                  <th className="py-1 pr-3 font-medium">Name / host</th>
                  <th className="py-1 font-medium">Value / points to</th>
                </tr>
              </thead>
              <tbody>
                {domain.records.map((r) => (
                  <tr key={r.type} className="border-t align-top">
                    <td className="py-2 pr-3 font-mono">{r.type}</td>
                    <td className="py-2 pr-3">
                      <CopyText value={r.host} label={`${r.type} name`} />
                      <span className="mt-1 block text-muted-foreground">({r.fullName})</span>
                    </td>
                    <td className="py-2">
                      <CopyText value={r.value} label={`${r.type} value`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!domain.verified && problems.length > 0 && !check?.ok && (
        <ul className="grid gap-1 text-sm text-amber-800 dark:text-amber-300">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function AddDomainForm({ action }: { action: Action }) {
  return (
    <SaveForm action={action} submitLabel="Add address" resetOnSave savedText="Added. Now add the DNS records below.">
      {(errors) => (
        <Field label="Your own address" name="hostname" error={errors.hostname} className="max-w-md">
          <Input name="hostname" placeholder="book.yourbusiness.co.uk" autoComplete="off" />
        </Field>
      )}
    </SaveForm>
  );
}
