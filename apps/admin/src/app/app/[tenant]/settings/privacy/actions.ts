"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { privacySettingsSchema, REQUEST_KINDS, REQUEST_STATUSES } from "@leadgen/core/privacy/rules";
import { cancelClosure, requestClosure } from "@leadgen/core/settings/account";
import { privacyExtrasFormSchema } from "@leadgen/core/settings/forms";
import type { SaveState } from "../../pricing/actions";
import { requireTenant } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

function fieldErrors(error: z.ZodError): SaveState {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) errors[String(issue.path[0] ?? "form")] ??= issue.message;
  return { errors };
}

// Who is responsible for customers' data, shown in the privacy notice on the
// booking page, and how long customer details are kept.
export async function savePrivacySettings(slug: string, formData: FormData): Promise<SaveState> {
  const { tenant, can } = await requireTenant(slug);
  if (!can("settings.edit")) return { message: "Your access level doesn't include changing this." };

  const parsed = privacySettingsSchema.safeParse({
    legalName: text(formData, "legalName"),
    privacyEmail: text(formData, "privacyEmail"),
    icoRegistration: text(formData, "icoRegistration"),
    retentionMonths: text(formData, "retentionMonths"),
  });
  if (!parsed.success) return fieldErrors(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("tenants")
    .update({
      legal_name: parsed.data.legalName || null,
      privacy_email: parsed.data.privacyEmail || null,
      ico_registration: parsed.data.icoRegistration || null,
      retention_months: parsed.data.retentionMonths,
    })
    .eq("id", tenant.id);
  if (error) {
    console.error("Privacy settings save failed", error);
    return { message: "Couldn't save. Try again." };
  }
  refresh();
  return { saved: true };
}

// Their own privacy policy link, the marketing tick box wording and how long
// customer photos are kept.
export async function savePrivacyExtras(slug: string, formData: FormData): Promise<SaveState> {
  const { tenant, can } = await requireTenant(slug);
  if (!can("settings.edit")) return { message: "Your access level doesn't include changing this." };
  const parsed = privacyExtrasFormSchema.safeParse({
    privacy_policy_url: text(formData, "privacy_policy_url"),
    marketing_consent_text: text(formData, "marketing_consent_text"),
    photo_retention_days: text(formData, "photo_retention_days"),
  });
  if (!parsed.success) return fieldErrors(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("tenants").update(parsed.data).eq("id", tenant.id);
  if (error) {
    console.error("Privacy extras save failed", error);
    return { message: "Couldn't save. Try again." };
  }
  refresh();
  return { saved: true };
}

// "Delete account": the owner types the business name to confirm. Billing
// stops at the end of the paid period and the platform deletes everything
// after the grace period, unless it's undone first.
export async function requestClosureAction(slug: string, formData: FormData): Promise<SaveState> {
  const { tenant, can, user } = await requireTenant(slug);
  if (!can("account.close")) return { message: "Only the business owner can close the account." };
  if (text(formData, "confirm_name").toLowerCase() !== tenant.name.trim().toLowerCase()) {
    return { errors: { confirm_name: `Type ${tenant.name} exactly to confirm.` } };
  }
  try {
    await requestClosure(tenant.id, user.id);
  } catch (error) {
    console.error("Account closure request failed", error);
    return { message: "Couldn't do that just now. Try again, or contact us." };
  }
  refresh();
  return { saved: true };
}

export async function cancelClosureAction(slug: string): Promise<SaveState> {
  const { tenant, can } = await requireTenant(slug);
  if (!can("account.close")) return { message: "Only the business owner can do this." };
  try {
    await cancelClosure(tenant.id);
  } catch (error) {
    console.error("Cancelling account closure failed", error);
    return { message: "Couldn't do that just now. Try again, or contact us." };
  }
  refresh();
  return { saved: true };
}

const requestSchema = z.object({
  kind: z.enum(Object.keys(REQUEST_KINDS) as [string, ...string[]], "Pick a type."),
  name: z.string().trim().min(1, "Enter their name.").max(100),
  email: z.union([z.literal(""), z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address."))]),
  details: z.string().trim().max(2000),
});

// A request that came in by phone, message or post. Starts the one-month clock.
export async function logRequest(slug: string, formData: FormData): Promise<SaveState> {
  const { tenant } = await requireTenant(slug);
  const parsed = requestSchema.safeParse({
    kind: text(formData, "kind"),
    name: text(formData, "name"),
    email: text(formData, "email"),
    details: text(formData, "details"),
  });
  if (!parsed.success) return fieldErrors(parsed.error);

  const supabase = await createClient();
  let customerId: string | null = null;
  if (parsed.data.email) {
    const match = await supabase
      .from("customers")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("email", parsed.data.email)
      .maybeSingle();
    customerId = match.data?.id ?? null;
  }

  const { error } = await supabase.from("data_requests").insert({
    tenant_id: tenant.id,
    customer_id: customerId,
    kind: parsed.data.kind,
    requester_name: parsed.data.name,
    requester_email: parsed.data.email || null,
    details: parsed.data.details || null,
    source: "manual",
  });
  if (error) {
    console.error("Log request failed", error);
    return { message: "Couldn't log the request. Try again." };
  }
  refresh();
  return { saved: true };
}

// Progress on a request: status, whether identity has been checked, and what
// was done. Closing it stamps the date.
export async function updateRequest(slug: string, id: string, formData: FormData): Promise<SaveState> {
  const { tenant } = await requireTenant(slug);
  const status = text(formData, "status");
  if (!(status in REQUEST_STATUSES)) return { message: "Pick a status." };
  const closed = status === "completed" || status === "refused";

  const supabase = await createClient();
  const { error } = await supabase
    .from("data_requests")
    .update({
      status,
      identity_checked: formData.get("identity_checked") === "on",
      outcome_notes: text(formData, "outcome_notes").slice(0, 2000) || null,
      closed_at: closed ? new Date().toISOString() : null,
    })
    .eq("tenant_id", tenant.id)
    .eq("id", id);
  if (error) {
    console.error("Update request failed", error);
    return { message: "Couldn't save. Try again." };
  }
  refresh();
  return { saved: true };
}
