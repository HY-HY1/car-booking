"use server";

import { after } from "next/server";
import { refresh } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { disconnectCalendar, reconcileCalendar, saveCalendarChoices } from "@leadgen/core/calendar/sync";
import { choosePage, disconnectMeta } from "@leadgen/core/meta/leads";
import { chooseLocation, disconnectBusiness, syncReviews } from "@leadgen/core/reviews/sync";
import {
  createEndpoint,
  deleteEndpoint,
  resendDelivery,
  rollSecret,
  sendTestEvent,
  updateEndpoint,
} from "@leadgen/core/webhooks/deliver";
import { isWebhookEvent, type WebhookEvent } from "@leadgen/core/webhooks/rules";
import { requireTenant } from "@/lib/auth";
import type { SaveState } from "@/app/app/[tenant]/pricing/actions";
import { failed, plain, requireOwner } from "../shared";

// Settings → Integrations → Google Calendar. Owners and managers; written
// with the secret key, so requireOwner is what stops anyone else.

// Google's calendar ids: "primary", an address, or a long group id.
const CALENDAR_ID = /^[^\s]{1,1024}$/;

export async function saveCalendarAction(slug: string, formData: FormData): Promise<SaveState> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return denied;

  const values = plain(formData);
  const defaultCalendarId = values.default_calendar ?? "";
  if (!CALENDAR_ID.test(defaultCalendarId)) return { errors: { default_calendar: "Pick one of your calendars." } };
  // resource:<id> → that van's own calendar, or "" for the business's.
  const byResource: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(values)) {
    if (!key.startsWith("resource:")) continue;
    if (value && !CALENDAR_ID.test(value)) return { message: "Pick one of your calendars for each van." };
    byResource[key.slice("resource:".length)] = value || null;
  }

  try {
    const result = await saveCalendarChoices(tenant.id, { defaultCalendarId, byResource });
    if (result.error) return { message: result.error };
  } catch (error) {
    return failed("your calendars", error);
  }
  // Jobs move to their new calendars, and busy times are read from them.
  after(() => reconcileCalendar(tenant.id));
  await logActivity(tenant.id, "settings.calendar", "Changed the Google Calendar settings");
  refresh();
  return { saved: true };
}

export async function disconnectCalendarAction(slug: string): Promise<SaveState> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return denied;
  try {
    await disconnectCalendar(tenant.id);
  } catch (error) {
    console.error("Disconnecting Google Calendar failed", error);
    return { message: "Couldn't disconnect Google Calendar. Try again." };
  }
  await logActivity(tenant.id, "settings.calendar_disconnected", "Disconnected Google Calendar");
  refresh();
  return {};
}

// ------------------------------------------------------- Google reviews

export async function chooseReviewLocationAction(slug: string, formData: FormData): Promise<SaveState> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return denied;
  const location = String(formData.get("location") ?? "");
  if (!/^locations\/[\w-]{1,100}$/.test(location)) return { errors: { location: "Pick your business." } };
  try {
    const result = await chooseLocation(tenant.id, location);
    if (result.error) return { message: result.error };
  } catch (error) {
    return failed("your business location", error);
  }
  after(() => syncReviews(tenant.id));
  await logActivity(tenant.id, "settings.reviews_location", "Picked the Google Business location");
  refresh();
  return { saved: true };
}

export async function refreshReviewsAction(slug: string): Promise<SaveState> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return denied;
  const result = await syncReviews(tenant.id);
  refresh();
  return result.error ? { message: result.error } : { saved: true };
}

export async function disconnectReviewsAction(slug: string): Promise<SaveState> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return denied;
  try {
    await disconnectBusiness(tenant.id);
  } catch (error) {
    console.error("Disconnecting Google Business Profile failed", error);
    return { message: "Couldn't disconnect Google. Try again." };
  }
  await logActivity(tenant.id, "settings.reviews_disconnected", "Disconnected Google Business Profile");
  refresh();
  return {};
}

// ------------------------------------------------------- Facebook lead forms

export async function chooseMetaPageAction(slug: string, formData: FormData): Promise<SaveState> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return denied;
  const page = String(formData.get("page") ?? "");
  if (!/^\d{1,30}$/.test(page)) return { errors: { page: "Pick a Page." } };
  try {
    const result = await choosePage(tenant.id, page);
    if (result.error) return { message: result.error };
  } catch (error) {
    return failed("your Facebook Page", error);
  }
  await logActivity(tenant.id, "settings.meta_page", "Picked the Facebook Page for lead forms");
  refresh();
  return { saved: true };
}

export async function disconnectMetaAction(slug: string): Promise<SaveState> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return denied;
  try {
    await disconnectMeta(tenant.id);
  } catch (error) {
    console.error("Disconnecting Facebook failed", error);
    return { message: "Couldn't disconnect Facebook. Try again." };
  }
  await logActivity(tenant.id, "settings.meta_disconnected", "Disconnected Facebook lead forms");
  refresh();
  return {};
}

// ------------------------------------------------------- webhooks (owners)

const WEBHOOK_DENIED = "Only the owner can change webhooks.";

async function requireDeveloper(slug: string) {
  const result = await requireTenant(slug);
  return { ...result, denied: result.can("api") ? null : WEBHOOK_DENIED };
}

const endpointSchema = z.object({
  url: z.string().trim().min(1, "Enter the address to send to.").max(2000, "That address is too long."),
  description: z.string().trim().max(200, "Keep the name under 200 characters."),
  events: z
    .array(z.string())
    .transform((e) => e.filter(isWebhookEvent) as WebhookEvent[])
    .refine((e) => e.length > 0, "Pick at least one event."),
});

function endpointInput(formData: FormData) {
  return endpointSchema.safeParse({
    url: formData.get("url") ?? "",
    description: formData.get("description") ?? "",
    events: formData.getAll("events").map(String),
  });
}

const issuesOf = (error: z.ZodError) => {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) errors[String(issue.path[0])] ??= issue.message;
  return errors;
};

export type WebhookSaveState = SaveState & { secret?: string };

export async function createWebhookAction(slug: string, formData: FormData): Promise<WebhookSaveState> {
  const { tenant, user, denied } = await requireDeveloper(slug);
  if (denied) return { message: denied };
  const parsed = endpointInput(formData);
  if (!parsed.success) return { errors: issuesOf(parsed.error) };
  try {
    const result = await createEndpoint(tenant.id, user.id, { ...parsed.data, description: parsed.data.description || null });
    if ("error" in result) return { errors: { url: result.error } };
    await logActivity(tenant.id, "settings.webhook_added", "Added a webhook");
    refresh();
    return { saved: true, secret: result.secret };
  } catch (error) {
    return failed("the webhook", error);
  }
}

export async function updateWebhookAction(slug: string, id: string, formData: FormData): Promise<SaveState> {
  const { tenant, denied } = await requireDeveloper(slug);
  if (denied) return { message: denied };
  if (!z.uuid().safeParse(id).success) return { message: "That webhook no longer exists." };
  const parsed = endpointInput(formData);
  if (!parsed.success) return { errors: issuesOf(parsed.error) };
  try {
    const result = await updateEndpoint(tenant.id, id, {
      ...parsed.data,
      description: parsed.data.description || null,
      active: formData.get("active") === "on",
    });
    if (result.error) return { errors: { url: result.error } };
  } catch (error) {
    return failed("the webhook", error);
  }
  await logActivity(tenant.id, "settings.webhook_changed", "Changed a webhook");
  refresh();
  return { saved: true };
}

export async function deleteWebhookAction(slug: string, id: string): Promise<{ error?: string }> {
  const { tenant, denied } = await requireDeveloper(slug);
  if (denied) return { error: denied };
  if (!z.uuid().safeParse(id).success) return {};
  try {
    await deleteEndpoint(tenant.id, id);
  } catch (error) {
    console.error("Deleting a webhook failed", error);
    return { error: "Couldn't delete it. Try again." };
  }
  await logActivity(tenant.id, "settings.webhook_deleted", "Deleted a webhook");
  refresh();
  return {};
}

export async function rollWebhookSecretAction(slug: string, id: string): Promise<{ error?: string; secret?: string }> {
  const { tenant, denied } = await requireDeveloper(slug);
  if (denied) return { error: denied };
  if (!z.uuid().safeParse(id).success) return { error: "That webhook no longer exists." };
  const secret = await rollSecret(tenant.id, id);
  if (!secret) return { error: "That webhook no longer exists." };
  await logActivity(tenant.id, "settings.webhook_secret", "Made a new webhook signing secret");
  return { secret };
}

export async function testWebhookAction(slug: string, id: string): Promise<{ error?: string; ok?: boolean; detail?: string }> {
  const { tenant, denied } = await requireDeveloper(slug);
  if (denied) return { error: denied };
  if (!z.uuid().safeParse(id).success) return { error: "That webhook no longer exists." };
  try {
    const result = await sendTestEvent(tenant.id, id);
    refresh();
    return { ok: result.ok, detail: result.status ? `Your server answered ${result.status}.` : (result.body ?? "No answer.") };
  } catch (error) {
    console.error("Testing a webhook failed", error);
    return { error: "Couldn't send the test. Try again." };
  }
}

export async function resendDeliveryAction(slug: string, deliveryId: string): Promise<{ error?: string }> {
  const { tenant, denied } = await requireDeveloper(slug);
  if (denied) return { error: denied };
  if (!z.uuid().safeParse(deliveryId).success) return {};
  try {
    await resendDelivery(tenant.id, deliveryId);
  } catch (error) {
    console.error("Resending a webhook failed", error);
    return { error: "Couldn't send it. Try again." };
  }
  refresh();
  return {};
}
