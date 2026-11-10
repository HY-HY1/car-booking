"use server";

import { refresh } from "next/cache";
import { logActivity } from "@/lib/activity";
import { notFound, redirect } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { z } from "zod";
import { eraseCustomer } from "@leadgen/core/privacy/data";
import { createAdminClient } from "@leadgen/core/supabase/admin";
import { requireAccess, requireTenant } from "@/lib/auth";
import { customerSchema, getCustomer, type CustomerInput } from "@/lib/customers";
import { deletePhotos } from "@/lib/photos";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/urls";

export type CustomerFormState = {
  errors?: Record<string, string | undefined>;
  message?: string;
  saved?: boolean;
  // Echoed back so the form keeps what was typed after an error.
  values?: Record<string, string>;
};

const FIELDS = [
  "name",
  "email",
  "phone",
  "address_line",
  "postcode",
  "notes",
  "source",
  "email_marketing",
  "sms_marketing",
  "whatsapp_marketing",
  "marketing_basis",
] as const;

const CHECKBOXES = new Set(["email_marketing", "sms_marketing", "whatsapp_marketing"]);

function formValues(formData: FormData) {
  const values: Record<string, string> = {};
  for (const field of FIELDS) {
    const value = formData.get(field);
    if (typeof value === "string") values[field] = value;
    // Unticked checkboxes aren't submitted, so they stay missing (false).
    else if (!CHECKBOXES.has(field)) values[field] = "";
  }
  return values;
}

function fieldErrors(error: z.ZodError) {
  const { fieldErrors } = z.flattenError(error);
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([field, messages]) => [
      field,
      (messages as string[] | undefined)?.[0],
    ]),
  );
}

function databaseError(
  error: PostgrestError,
  values: Record<string, string>,
): CustomerFormState {
  if (error.code === "23505") {
    const field = error.message.includes("phone") ? "phone" : "email";
    return {
      values,
      errors: { [field]: `Another customer already has this ${field === "phone" ? "number" : "email"}.` },
    };
  }
  console.error("Customer save failed", error);
  return { values, message: "Couldn't save the customer. Try again." };
}

function hasMarketing(c: CustomerInput) {
  return c.email_marketing || c.sms_marketing || c.whatsapp_marketing;
}

export async function createCustomer(
  slug: string,
  _prev: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const { tenant } = await requireAccess(slug, "customers.view");
  const values = formValues(formData);
  const parsed = customerSchema.safeParse(values);
  if (!parsed.success) return { values, errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({
      ...parsed.data,
      tenant_id: tenant.id,
      marketing_updated_at: hasMarketing(parsed.data)
        ? new Date().toISOString()
        : null,
    })
    .select("id")
    .single();

  if (error) return databaseError(error, values);
  await logActivity(tenant.id, "customer.added", "Added a customer", { type: "customer", id: data.id });
  redirect(appUrl(`/${slug}/customers/${data.id}`));
}

export async function updateCustomer(
  slug: string,
  id: string,
  _prev: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const { tenant } = await requireAccess(slug, "customers.view");
  const existing = await getCustomer(tenant.id, id);
  if (!existing) notFound();

  const values = formValues(formData);
  const parsed = customerSchema.safeParse(values);
  if (!parsed.success) return { values, errors: fieldErrors(parsed.error) };
  const c = parsed.data;

  // Only move the consent timestamp when the consent itself changed.
  const marketingChanged =
    c.email_marketing !== existing.email_marketing ||
    c.sms_marketing !== existing.sms_marketing ||
    c.whatsapp_marketing !== existing.whatsapp_marketing ||
    c.marketing_basis !== existing.marketing_basis;

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({
      ...c,
      ...(marketingChanged && { marketing_updated_at: new Date().toISOString() }),
    })
    .eq("tenant_id", tenant.id)
    .eq("id", id);

  if (error) return databaseError(error, values);
  await logActivity(tenant.id, "customer.edited", "Edited a customer", { type: "customer", id });
  refresh();
  return { values, saved: true };
}

// "Erase" rather than a plain delete: a customer who has bookings can't just be
// removed (the business needs its sales records), so their details are wiped
// from those bookings instead. One with no bookings is deleted outright. Photo
// files go too. Owner-only; the tenant comes from the session.
export async function deleteCustomer(
  slug: string,
  id: string,
): Promise<{ error?: string }> {
  const { tenant, can } = await requireTenant(slug);
  if (!can("customers.delete")) {
    return { error: "Your access level doesn't include erasing customers." };
  }

  try {
    const result = await eraseCustomer(tenant.id, id);
    if (result === "not_found") return { error: "That customer no longer exists." };
    await logActivity(tenant.id, "customer.erased", "Erased a customer");
    if (result === "anonymised") {
      redirect(appUrl(`/${slug}/customers/${id}?erased=1`));
    }
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error("Customer erase failed", error);
    return { error: "Couldn't erase the customer. Try again." };
  }
  redirect(appUrl(`/${slug}/customers`));
}

// Folds a duplicate into this customer, in one transaction in the database.
export async function mergeCustomerAction(slug: string, keepId: string, removeId: string): Promise<{ error?: string }> {
  const { tenant, can } = await requireTenant(slug);
  if (!can("customers.delete")) return { error: "Your access level doesn't include merging customers." };
  if (!z.uuid().safeParse(keepId).success || !z.uuid().safeParse(removeId).success) return { error: "That customer no longer exists." };

  const { data, error } = await createAdminClient().rpc("merge_customers", { p_tenant: tenant.id, p_keep: keepId, p_remove: removeId });
  if (error) {
    console.error("Merging customers failed", error);
    return { error: "Couldn't merge them. Try again." };
  }
  if (data !== "merged") return { error: "One of them has been erased or no longer exists." };
  await logActivity(tenant.id, "customer.merged", "Merged two customers", { type: "customer", id: keepId });
  refresh();
  return {};
}

export async function deletePhoto(slug: string, photoId: string): Promise<{ error?: string }> {
  const { tenant, can } = await requireTenant(slug);
  if (!can("customers.delete")) return { error: "Your access level doesn't include deleting photos." };
  try {
    await deletePhotos(tenant.id, { id: photoId });
  } catch (error) {
    console.error("Photo delete failed", error);
    return { error: "Couldn't delete the photo. Try again." };
  }
  await logActivity(tenant.id, "customer.photo_deleted", "Deleted a photo");
  refresh();
  return {};
}
