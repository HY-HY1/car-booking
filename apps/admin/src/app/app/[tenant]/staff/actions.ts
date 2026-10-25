"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { serviceAreaSchema } from "@leadgen/core/booking/config";
import { staffFormSchema } from "@leadgen/core/staff/rules";
import type { SaveState } from "@/app/app/[tenant]/pricing/actions";
import { requireTenant } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Saves from Staff / Techs. Owner-only (RLS enforces the same). Every write
// is filtered on the tenant from the URL's membership check, never an id from
// the form.

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
  if (!can("staff.edit")) return { tenant, denied: { message: "Your access level doesn't include changing the team." } };
  return { tenant, denied: null };
}

function failed(error: { code?: string }): SaveState {
  // 23503: the van or bay was deleted since the page loaded.
  if (error.code === "23503") return { errors: { resource_id: "That van or bay no longer exists." } };
  console.error("Saving staff failed", error);
  return { message: "Couldn't save that. Try again." };
}

function plain(formData: FormData) {
  const values: Record<string, string> = {};
  for (const [key, value] of formData) if (typeof value === "string") values[key] = value;
  return values;
}

export async function saveStaff(slug: string, id: string | null, formData: FormData): Promise<SaveState> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return denied;
  const parsed = staffFormSchema.safeParse(plain(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  if (id && !z.uuid().safeParse(id).success) return { message: "That person no longer exists." };
  const fields = parsed.data;

  const supabase = await createClient();

  // The territory has to be one of this business's current ones. Until some
  // are saved, the only one is the default.
  if (fields.territory_id) {
    const { data } = await supabase.from("booking_settings").select("service_area").eq("tenant_id", tenant.id).maybeSingle();
    const area = serviceAreaSchema.safeParse(data?.service_area);
    const ids = area.success && "territories" in area.data ? area.data.territories.map((t) => t.id) : ["default"];
    if (!ids.includes(fields.territory_id)) {
      return { errors: { territory_id: "That territory no longer exists." } };
    }
  }

  if (id) {
    const { data, error } = await supabase.from("staff").update(fields).eq("tenant_id", tenant.id).eq("id", id).select("id");
    if (error) return failed(error);
    if (!data?.length) return { message: "That person no longer exists." };
  } else {
    // New people go to the end of the list.
    const { data: last } = await supabase
      .from("staff")
      .select("sort_order")
      .eq("tenant_id", tenant.id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await supabase
      .from("staff")
      .insert({ ...fields, sort_order: (last?.sort_order ?? -1) + 1, tenant_id: tenant.id });
    if (error) return failed(error);
  }
  refresh();
  return { saved: true };
}

export async function deleteStaff(slug: string, id: string): Promise<SaveState> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return denied;
  if (!z.uuid().safeParse(id).success) return { message: "That person no longer exists." };

  const supabase = await createClient();
  const { error } = await supabase.from("staff").delete().eq("tenant_id", tenant.id).eq("id", id);
  if (error) return failed(error);
  refresh();
  return { saved: true };
}
