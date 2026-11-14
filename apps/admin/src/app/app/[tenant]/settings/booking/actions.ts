"use server";

import { refresh } from "next/cache";
import { logActivity } from "@/lib/activity";
import { z } from "zod";
import {
  bookingRulesFormSchema,
  hoursFormSchema,
  locationsFormSchema,
  multiCarFormSchema,
  resourceFormSchema,
} from "@leadgen/core/booking/settings-rules";
import { askingFormSchema, parsePolicyForm } from "@leadgen/core/settings/forms";
import { storedPolicyOf } from "@leadgen/core/settings/policy";
import type { SaveState } from "@/app/app/[tenant]/pricing/actions";
import { nextOrder, writeOrder } from "@/lib/reorder";
import { createClient } from "@/lib/supabase/server";
import { failed, fieldErrors, plain, requireOwner } from "../shared";

// Saves from Settings → Hours & rules. Owners and managers (settings.edit);
// RLS lets the same people write. Every write is filtered on the tenant from
// the URL's membership check, never an id from the form.

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
    // A setting whose column hasn't reached the database yet (a migration
    // still to apply): say so rather than "try again".
    if (error.code === "PGRST204" || error.code === "42703") {
      console.error(`Saving ${what} failed: the database needs updating`, error);
      return { message: "This setting can't be saved until the database is updated. Nothing else is affected." };
    }
    // The database refuses a business that offers nothing, or a shop with no postcode.
    return failed(what, error);
  }
  if (!data?.length) return { message: "Booking isn't set up for this business yet." };
  await logActivity(tenant.id, "settings.booking_rules", `Changed ${what.replace(/^your /, "the ")}`);
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

// Whether customers can book more than one car, and the time saved on each.
export async function saveMultiCar(slug: string, formData: FormData): Promise<SaveState> {
  return updateSettings(slug, multiCarFormSchema, "the settings for more than one car", formData);
}

// Photos, which questions are asked, and whether bookings need approving.
export async function saveAsking(slug: string, formData: FormData): Promise<SaveState> {
  return updateSettings(slug, askingFormSchema, "what you ask customers", formData);
}

// Cancellation and rescheduling cut-offs. The refund side (Settings →
// Payments) is kept as it is, and so is the whole policy when it's switched
// off, ready for switching back on.
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

  const parsed = parsePolicyForm(plain(formData), storedPolicyOf(current.data.cancellation_policy));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { error } = await supabase
    .from("booking_settings")
    .update({ cancellation_policy: parsed.data })
    .eq("tenant_id", tenant.id);
  if (error) return failed("the cancellation policy", error);
  const on = formData.get("policy_enabled") === "on";
  await logActivity(tenant.id, "settings.cancellation", on ? "Changed the cancellation policy" : "Switched off the cancellation policy");
  refresh();
  return { saved: true };
}

// --------------------------------------------------------------- vans and bays

export async function saveResource(slug: string, id: string | null, formData: FormData): Promise<SaveState> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return denied;
  const parsed = resourceFormSchema.safeParse(plain(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const fields = parsed.data;

  const supabase = await createClient();
  if (id) {
    if (!z.uuid().safeParse(id).success) return { message: "That one no longer exists." };
    const { data, error } = await supabase
      .from("resources")
      .update(fields)
      .eq("tenant_id", tenant.id)
      .eq("id", id)
      .select("id");
    if (error) return failed("that", error);
    if (!data?.length) return { message: "That one no longer exists." };
  } else {
    const { error } = await supabase
      .from("resources")
      .insert({ ...fields, sort_order: await nextOrder("resources", tenant.id), tenant_id: tenant.id });
    if (error) return failed("that", error);
  }
  await logActivity(tenant.id, "settings.resource_saved", `${id ? "Edited" : "Added"} ${fields.name}`);
  refresh();
  return { saved: true };
}

export async function reorderResources(slug: string, ids: string[]): Promise<SaveState> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return denied;
  const result = await writeOrder("resources", tenant.id, ids);
  if (!result.message) refresh();
  return result;
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
  await logActivity(tenant.id, "settings.resource_deleted", "Deleted a van or bay");
  refresh();
  return { saved: true };
}
