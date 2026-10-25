"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import {
  bookingRulesFormSchema,
  hoursFormSchema,
  locationsFormSchema,
  resourceFormSchema,
} from "@leadgen/core/booking/settings-rules";
import { askingFormSchema, parsePolicyForm } from "@leadgen/core/settings/forms";
import { policyOf } from "@leadgen/core/settings/policy";
import type { SaveState } from "@/app/app/[tenant]/pricing/actions";
import { requireTenant } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Saves from Settings → Booking. Owner-only (RLS enforces the same). Every
// write is filtered on the tenant from the URL's membership check, never an
// id from the form.

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
  if (!can("settings.edit")) return { tenant, denied: { message: "Your access level doesn't include changing settings." } };
  return { tenant, denied: null };
}

function failed(what: string, error: unknown): SaveState {
  console.error(`${what} failed`, error);
  return { message: `Couldn't save ${what}. Try again.` };
}

function plain(formData: FormData) {
  const values: Record<string, string> = {};
  for (const [key, value] of formData) if (typeof value === "string") values[key] = value;
  return values;
}

async function updateSettings(slug: string, schema: z.ZodType<Record<string, unknown>>, what: string, formData: FormData) {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return denied;
  const parsed = schema.safeParse(plain(formData));
  if (!parsed.success) return fieldErrors(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("booking_settings")
    .update(parsed.data)
    .eq("tenant_id", tenant.id)
    .select("tenant_id");
  if (error) {
    // The database refuses a business that offers nothing, or a shop with no postcode.
    return failed(what, error);
  }
  if (!data?.length) return { message: "Booking isn't set up for this business yet." };
  refresh();
  return { saved: true };
}

export async function saveLocations(slug: string, formData: FormData): Promise<SaveState> {
  return updateSettings(slug, locationsFormSchema, "where you work", formData);
}

export async function saveHours(slug: string, formData: FormData): Promise<SaveState> {
  return updateSettings(slug, hoursFormSchema, "your opening hours", formData);
}

export async function saveBookingRules(slug: string, formData: FormData): Promise<SaveState> {
  return updateSettings(slug, bookingRulesFormSchema, "the booking rules", formData);
}

// Photos, which questions are asked, and whether bookings need approving.
export async function saveAsking(slug: string, formData: FormData): Promise<SaveState> {
  return updateSettings(slug, askingFormSchema, "what you ask customers", formData);
}

// Cancellation and rescheduling cut-offs. The refund side (Settings →
// Payments) is kept as it is.
export async function savePolicy(slug: string, formData: FormData): Promise<SaveState> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return denied;
  const supabase = await createClient();
  const current = await supabase
    .from("booking_settings")
    .select("cancellation_policy")
    .eq("tenant_id", tenant.id)
    .maybeSingle();
  if (current.error) return failed("the cancellation policy", current.error);
  if (!current.data) return { message: "Booking isn't set up for this business yet." };

  const parsed = parsePolicyForm(plain(formData), policyOf(current.data.cancellation_policy));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { error } = await supabase
    .from("booking_settings")
    .update({ cancellation_policy: parsed.data })
    .eq("tenant_id", tenant.id);
  if (error) return failed("the cancellation policy", error);
  refresh();
  return { saved: true };
}

// --------------------------------------------------------------- vans and bays

export async function saveResource(slug: string, id: string | null, formData: FormData): Promise<SaveState> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return denied;
  const parsed = resourceFormSchema.safeParse(plain(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { sort_order, ...fields } = parsed.data;

  const supabase = await createClient();
  if (id) {
    if (!z.uuid().safeParse(id).success) return { message: "That one no longer exists." };
    const { error } = await supabase
      .from("resources")
      .update({ ...fields, ...(sort_order !== undefined && { sort_order }) })
      .eq("tenant_id", tenant.id)
      .eq("id", id);
    if (error) return failed("that", error);
  } else {
    // New ones go to the end of the line unless an order is given.
    let order = sort_order;
    if (order === undefined) {
      const { data } = await supabase
        .from("resources")
        .select("sort_order")
        .eq("tenant_id", tenant.id)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      order = (data?.sort_order ?? -1) + 1;
    }
    const { error } = await supabase
      .from("resources")
      .insert({ ...fields, sort_order: order, tenant_id: tenant.id });
    if (error) return failed("that", error);
  }
  refresh();
  return { saved: true };
}

export async function deleteResource(slug: string, id: string): Promise<SaveState> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return denied;
  if (!z.uuid().safeParse(id).success) return { message: "That one no longer exists." };

  const supabase = await createClient();
  const { count, error: countError } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenant.id)
    .eq("resource_id", id);
  if (countError) return failed("that", countError);
  if (count) {
    return {
      message: `It has ${count} ${count === 1 ? "booking" : "bookings"} on record, so it can't be deleted. Switch it off instead and it takes no new bookings.`,
    };
  }

  const { error } = await supabase.from("resources").delete().eq("tenant_id", tenant.id).eq("id", id);
  if (error) {
    // 23503: a booking still points at it (made since we counted).
    if (error.code === "23503") return { message: "It has bookings on record, so it can't be deleted. Switch it off instead." };
    return failed("that", error);
  }
  refresh();
  return { saved: true };
}
