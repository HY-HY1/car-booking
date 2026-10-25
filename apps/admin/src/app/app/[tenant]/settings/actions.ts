"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { customHostnameSchema } from "@leadgen/core/settings/domains";
import { addCustomDomain, checkCustomDomain, makePrimaryDomain, removeCustomDomain } from "@leadgen/core/settings/domains-server";
import { brandingFormSchema, generalFormSchema } from "@leadgen/core/settings/forms";
import type { SaveState } from "@/app/app/[tenant]/pricing/actions";
import { SERVICE_IMAGE_MAX_BYTES, SERVICE_IMAGE_TYPES, serviceImageUrl } from "@/lib/pricing-fields";
import { stripeOnboardingUrl } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { failed, fieldErrors, plain, requireOwner } from "./shared";

// "Connect Stripe" / "Continue setup": on to Stripe's hosted onboarding.
export async function connectStripeAction(slug: string) {
  redirect(await stripeOnboardingUrl(slug));
}

// ------------------------------------------------------------------ General

// Business name, contact details, what they do, time zone and VAT. Owner-only
// (RLS enforces the same).
export async function saveGeneralAction(slug: string, formData: FormData): Promise<SaveState> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return denied;
  const parsed = generalFormSchema.safeParse(plain(formData));
  if (!parsed.success) return fieldErrors(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("tenants").update(parsed.data.tenant).eq("id", tenant.id);
  if (error) return failed("your business details", error);
  // The time zone lives with the booking rules, which read it.
  const tz = await supabase
    .from("booking_settings")
    .update({ timezone: parsed.data.timezone })
    .eq("tenant_id", tenant.id);
  if (tz.error) return failed("the time zone", tz.error);
  refresh();
  return { saved: true };
}

// ------------------------------------------------------------ Booking page

const IMAGE_BUCKET = "service-images";
// What a stored image URL starts with, so the old file can be found and removed.
const PUBLIC_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${IMAGE_BUCKET}/`;

function imageFile(formData: FormData, name: string) {
  const f = formData.get(name);
  return f instanceof File && f.size > 0 ? f : null;
}

// Colours, logo, cover image, tagline, website link and the website button.
// Logo and cover go in the public service-images bucket, under the
// business's own folder (only its owners can write there).
export async function saveBrandingAction(slug: string, formData: FormData): Promise<SaveState> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return denied;
  const parsed = brandingFormSchema.safeParse(plain(formData));
  if (!parsed.success) return fieldErrors(parsed.error);

  const files = { logo: imageFile(formData, "logo"), cover: imageFile(formData, "cover") };
  for (const [name, file] of Object.entries(files)) {
    if (!file) continue;
    if (!SERVICE_IMAGE_TYPES[file.type]) return { errors: { [name]: "Use a JPG, PNG or WebP image." } };
    if (file.size > SERVICE_IMAGE_MAX_BYTES) return { errors: { [name]: "Images can be up to 5 MB." } };
  }

  const supabase = await createClient();
  const current = await supabase.from("tenants").select("branding").eq("id", tenant.id).single();
  if (current.error) return failed("your booking page", current.error);
  const before = (current.data.branding ?? {}) as Record<string, unknown>;

  const upload = async (file: File) => {
    const path = `${tenant.id}/brand/${crypto.randomUUID()}.${SERVICE_IMAGE_TYPES[file.type]}`;
    const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, { contentType: file.type });
    if (error) throw error;
    return serviceImageUrl(path)!;
  };

  const stale: string[] = [];
  const image = async (key: "logo_url" | "cover_url", file: File | null, remove: boolean) => {
    const old = typeof before[key] === "string" ? (before[key] as string) : undefined;
    if (!file && !remove) return old;
    if (old?.startsWith(PUBLIC_PREFIX)) stale.push(old.slice(PUBLIC_PREFIX.length));
    return file ? upload(file) : undefined;
  };

  let branding: Record<string, unknown>;
  try {
    branding = {
      ...before,
      ...parsed.data,
      logo_url: await image("logo_url", files.logo, formData.get("remove_logo") === "on"),
      cover_url: await image("cover_url", files.cover, formData.get("remove_cover") === "on"),
    };
  } catch (error) {
    return failed("the images", error);
  }
  // Blank fields are taken out rather than stored empty.
  for (const key of Object.keys(branding)) if (branding[key] === undefined) delete branding[key];

  const { error } = await supabase.from("tenants").update({ branding }).eq("id", tenant.id);
  if (error) return failed("your booking page", error);
  if (stale.length) await supabase.storage.from(IMAGE_BUCKET).remove(stale);
  refresh();
  return { saved: true };
}

// ------------------------------------------------------------- Custom domains

export async function addDomainAction(slug: string, formData: FormData): Promise<SaveState> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return denied;
  const parsed = customHostnameSchema().safeParse(String(formData.get("hostname") ?? ""));
  if (!parsed.success) return { errors: { hostname: parsed.error.issues[0].message } };
  try {
    const result = await addCustomDomain(tenant.id, parsed.data);
    if (!result.ok) return { errors: { hostname: result.message } };
  } catch (error) {
    return failed("that address", error);
  }
  refresh();
  return { saved: true };
}

export type DomainCheckState = { ok?: boolean; problems?: string[]; message?: string };

export async function checkDomainAction(slug: string, domainId: string): Promise<DomainCheckState> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return { message: denied.message };
  if (!z.uuid().safeParse(domainId).success) return { message: "That address isn't connected any more." };
  try {
    const result = await checkCustomDomain(tenant.id, domainId);
    refresh();
    return result;
  } catch (error) {
    console.error("Checking a domain failed", error);
    return { message: "Couldn't check the DNS just now. Try again in a minute." };
  }
}

export async function removeDomainAction(slug: string, domainId: string): Promise<{ message?: string }> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return { message: denied.message };
  if (!z.uuid().safeParse(domainId).success) return {};
  try {
    await removeCustomDomain(tenant.id, domainId);
  } catch (error) {
    console.error("Removing a domain failed", error);
    return { message: "Couldn't remove it. Try again." };
  }
  refresh();
  return {};
}

export async function makePrimaryDomainAction(slug: string, domainId: string): Promise<{ message?: string }> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return { message: denied.message };
  if (!z.uuid().safeParse(domainId).success) return {};
  try {
    const result = await makePrimaryDomain(tenant.id, domainId);
    if (!result.ok) return { message: result.message };
  } catch (error) {
    console.error("Changing the main address failed", error);
    return { message: "Couldn't change it. Try again." };
  }
  refresh();
  return {};
}
