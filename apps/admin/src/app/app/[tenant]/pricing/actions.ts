"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireTenant } from "@/lib/auth";
import { addOnFormSchema, formObject, rulesFormSchema, serviceFormSchema } from "@/lib/pricing";
import { GALLERY_MAX, SERVICE_IMAGE_MAX_BYTES, SERVICE_IMAGE_TYPES } from "@/lib/pricing-fields";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/urls";

// Saves from the pricing editor. Owner-only (RLS enforces the same). Every
// write is filtered on the tenant from the URL's membership check, never an
// id from the form.

export type SaveState = {
  errors?: Record<string, string | undefined>;
  message?: string;
  saved?: boolean;
};

function fieldErrors(error: z.ZodError): SaveState {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    errors[field] ??= issue.message;
  }
  return { errors, message: errors.form };
}

async function requireOwner(slug: string) {
  const { tenant, can } = await requireTenant(slug);
  if (!can("pricing.edit")) return { tenant, denied: { message: "Your access level doesn't include changing prices." } };
  return { tenant, denied: null };
}

function failed(what: string, error: unknown): SaveState {
  console.error(`${what} failed`, error);
  return { message: `Couldn't save the ${what}. Try again.` };
}

const IMAGE_BUCKET = "service-images";

function imageProblem(file: File) {
  if (!SERVICE_IMAGE_TYPES[file.type]) return "Use JPG, PNG or WebP images.";
  if (file.size > SERVICE_IMAGE_MAX_BYTES) return `${file.name} is over 5 MB.`;
  return null;
}

function files(formData: FormData, name: string) {
  return formData.getAll(name).filter((f): f is File => f instanceof File && f.size > 0);
}

export async function saveService(slug: string, id: string | null, formData: FormData): Promise<SaveState> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return denied;
  const parsed = serviceFormSchema.safeParse(formObject(formData));
  if (!parsed.success) return fieldErrors(parsed.error);

  const header = files(formData, "image")[0] ?? null;
  const added = files(formData, "gallery_new");
  const kept = formData.getAll("gallery_keep").filter((v): v is string => typeof v === "string");
  const removeHeader = formData.get("remove_image") === "on";
  for (const file of [header, ...added]) {
    const problem = file && imageProblem(file);
    if (problem) return { errors: { [file === header ? "image" : "gallery"]: problem } };
  }

  const supabase = await createClient();
  let current: { image_path: string | null; gallery: string[] } = { image_path: null, gallery: [] };
  if (id) {
    const { data, error } = await supabase
      .from("services")
      .select("image_path, gallery")
      .eq("tenant_id", tenant.id)
      .eq("id", id)
      .maybeSingle();
    if (error) return failed("service", error);
    if (data) current = data;
  }
  // Only paths the service already has can be kept; nothing else from the form is trusted.
  const keptGallery = current.gallery.filter((p) => kept.includes(p));
  if (keptGallery.length + added.length > GALLERY_MAX) {
    return { errors: { gallery: `Up to ${GALLERY_MAX} gallery images.` } };
  }

  const slugTaken = { errors: { slug: "Another service already uses that link name." } };
  let serviceId = id;
  if (id) {
    const { error } = await supabase.from("services").update(parsed.data).eq("tenant_id", tenant.id).eq("id", id);
    if (error) return error.code === "23505" ? slugTaken : failed("service", error);
  } else {
    const { data, error } = await supabase
      .from("services")
      .insert({ ...parsed.data, tenant_id: tenant.id })
      .select("id")
      .single();
    if (error) return error.code === "23505" ? slugTaken : failed("service", error);
    serviceId = data.id;
  }

  const folder = `${tenant.id}/${serviceId}`;
  const upload = async (file: File) => {
    const path = `${folder}/${crypto.randomUUID()}.${SERVICE_IMAGE_TYPES[file.type]}`;
    const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, { contentType: file.type });
    if (error) throw error;
    return path;
  };

  try {
    const update: { image_path?: string | null; gallery?: string[] } = {};
    const stale: string[] = [];
    if (header || removeHeader) {
      update.image_path = header ? await upload(header) : null;
      if (current.image_path) stale.push(current.image_path);
    }
    if (added.length || keptGallery.length !== current.gallery.length) {
      update.gallery = [...keptGallery, ...(await Promise.all(added.map(upload)))];
      stale.push(...current.gallery.filter((p) => !keptGallery.includes(p)));
    }
    if (Object.keys(update).length) {
      const { error } = await supabase.from("services").update(update).eq("tenant_id", tenant.id).eq("id", serviceId!);
      if (error) throw error;
      if (stale.length) await supabase.storage.from(IMAGE_BUCKET).remove(stale);
    }
  } catch (error) {
    return failed("images", error);
  }

  refresh();
  if (!id) redirect(appUrl(`/${slug}/pricing/services/${serviceId}`));
  return { saved: true };
}

export async function deleteService(slug: string, id: string): Promise<SaveState> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return denied;
  // Past bookings keep their price: it's frozen in each booking's quote.
  const supabase = await createClient();
  const { data: files } = await supabase.storage.from(IMAGE_BUCKET).list(`${tenant.id}/${id}`);
  const { error } = await supabase.from("services").delete().eq("tenant_id", tenant.id).eq("id", id);
  if (error) return failed("service", error);
  if (files?.length) {
    await supabase.storage.from(IMAGE_BUCKET).remove(files.map((f) => `${tenant.id}/${id}/${f.name}`));
  }

  // Extras limited to just this service would otherwise go with nothing.
  const { data: addOns } = await supabase
    .from("add_ons")
    .select("id, service_ids")
    .eq("tenant_id", tenant.id)
    .contains("service_ids", [id]);
  for (const a of addOns ?? []) {
    const rest = (a.service_ids as string[]).filter((s) => s !== id);
    await supabase
      .from("add_ons")
      .update(rest.length ? { service_ids: rest } : { service_ids: rest, active: false })
      .eq("tenant_id", tenant.id)
      .eq("id", a.id);
  }
  refresh();
  redirect(appUrl(`/${slug}/pricing`));
}

export async function saveAddOn(slug: string, id: string | null, formData: FormData): Promise<SaveState> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return denied;
  const parsed = addOnFormSchema.safeParse(formObject(formData));
  if (!parsed.success) return fieldErrors(parsed.error);

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("add_ons").update(parsed.data).eq("tenant_id", tenant.id).eq("id", id)
    : await supabase.from("add_ons").insert({ ...parsed.data, tenant_id: tenant.id });
  if (error) return failed("extra", error);
  refresh();
  return { saved: true };
}

export async function deleteAddOn(slug: string, id: string): Promise<SaveState> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return denied;
  const supabase = await createClient();
  const { error } = await supabase.from("add_ons").delete().eq("tenant_id", tenant.id).eq("id", id);
  if (error) return failed("extra", error);
  refresh();
  return { saved: true };
}

export async function savePricingRules(slug: string, formData: FormData): Promise<SaveState> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return denied;
  const parsed = rulesFormSchema.safeParse(formObject(formData));
  if (!parsed.success) return fieldErrors(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("booking_settings").update(parsed.data).eq("tenant_id", tenant.id);
  if (error) return failed("pricing rules", error);
  refresh();
  return { saved: true };
}
