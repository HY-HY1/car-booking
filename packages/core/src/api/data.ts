import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DAY_KEYS, type DepositRule, type WeeklyHours } from "../booking/config";
import { getBookingConfig } from "../booking/engine";
import { createAdminClient } from "../supabase/admin";
import { brandingSchema, getCustomDomain } from "../tenants";
import { tenantUrl } from "../urls";
import { sendLeadWebhook, createEndpoint, deleteEndpoint } from "../webhooks/deliver";
import { isWebhookEvent } from "../webhooks/events";
import {
  encodeCursor,
  type BookingListParams,
  type CreateLeadInput,
  type CustomerListParams,
  type Cursor,
  type LeadListParams,
} from "./query";
import {
  API_EXTERNAL_PREFIX,
  BOOKING_COLUMNS,
  bookingResource,
  CUSTOMER_COLUMNS,
  customerResource,
  LEAD_COLUMNS,
  leadResource,
  VISIBLE_BOOKING_STATUSES,
  type BookingRow,
  type CustomerRow,
  type LeadRow,
} from "./resources";
import type { Booking, Business, Customer, Deposit, Lead, List, OpeningHours, Webhook, WebhookEventType } from "./types";

// What the public API reads and writes, for one business at a time. The
// tenant id always comes from the API key (keys.ts), never from the request.
// Uses the secret key, so every query here filters on tenant_id itself.

type Db = SupabaseClient;

// ------------------------------------------------------------------ business

const DAY_NAMES = {
  mon: "monday",
  tue: "tuesday",
  wed: "wednesday",
  thu: "thursday",
  fri: "friday",
  sat: "saturday",
  sun: "sunday",
} as const;

function openingHours(hours: WeeklyHours): OpeningHours {
  const out = {} as OpeningHours;
  for (const key of [...DAY_KEYS.slice(1), DAY_KEYS[0]]) {
    out[DAY_NAMES[key]] = (hours[key] ?? []).map(([opens, closes]) => ({ opens, closes }));
  }
  return out;
}

function depositOf(rule: DepositRule): Deposit {
  switch (rule.type) {
    case "percent":
      return { type: "percent", percent: rule.value };
    case "fixed":
      return { type: "fixed", amountPence: rule.value_pence };
    default:
      return { type: rule.type };
  }
}

export async function tenantBasics(tenantId: string) {
  const [tenant, customDomain] = await Promise.all([
    createAdminClient()
      .from("tenants")
      .select("name, slug, branding, contact_email, contact_phone, privacy_policy_url")
      .eq("id", tenantId)
      .single(),
    getCustomDomain({ id: tenantId }),
  ]);
  if (tenant.error) throw tenant.error;
  const t = tenant.data;
  const url = (path: string) => tenantUrl(t.slug, path, { absolute: true, customDomain });
  return { ...t, branding: brandingSchema.parse(t.branding ?? {}), url };
}

export async function getBusiness(tenantId: string): Promise<Business> {
  const [t, config] = await Promise.all([tenantBasics(tenantId), getBookingConfig(tenantId)]);
  const s = config?.settings;
  return {
    name: t.name,
    tagline: t.branding.tagline?.trim() || null,
    bookingUrl: t.url("/"),
    websiteUrl: t.branding.website_url ?? null,
    contact: { email: t.contact_email, phone: t.contact_phone },
    branding: {
      logoUrl: t.branding.logo_url ?? null,
      coverUrl: t.branding.cover_url ?? null,
      primaryColor: t.branding.primary_color,
      accentColor: t.branding.accent_color,
    },
    locations: {
      mobile: Boolean(s?.offers_mobile),
      unit: s?.offers_unit ? { address: s.unit_address, postcode: s.unit_postcode } : null,
    },
    openingHours: {
      mobile: s?.offers_mobile ? openingHours(s.weekly_hours) : null,
      unit: s?.offers_unit ? openingHours(s.unit_weekly_hours ?? s.weekly_hours) : null,
    },
    booking: {
      approvalRequired: s?.approval_mode === "manual",
      minNoticeHours: s?.min_notice_hours ?? 0,
      maxDaysAhead: s?.max_days_ahead ?? 0,
      deposit: s ? depositOf(s.deposit) : { type: "none" },
    },
    links: {
      terms: t.branding.terms_url ?? t.url("/terms"),
      privacy: t.privacy_policy_url ?? t.url("/privacy"),
    },
    timezone: s?.timezone ?? "Europe/London",
    currency: "GBP",
  };
}

// The business's time zone, or null when it has no booking settings yet (it
// can't be quoted or booked until it has).
export async function timezoneOf(tenantId: string): Promise<string | null> {
  const { data, error } = await createAdminClient().from("booking_settings").select("timezone").eq("tenant_id", tenantId).maybeSingle();
  if (error) throw error;
  return (data?.timezone as string | undefined) ?? null;
}

// ------------------------------------------------------------------ paging

// PostgREST filter values with reserved characters (timestamps have : and .)
// go in double quotes.
const quoted = (value: string) => `"${value.replace(/"/g, '\\"')}"`;

// Rows after the cursor, for an order on (column, id) in the given direction.
function afterCursor(column: string, ascending: boolean, cursor: Cursor) {
  const op = ascending ? "gt" : "lt";
  const after = quoted(cursor.after);
  return `${column}.${op}.${after},and(${column}.eq.${after},id.${op}.${cursor.id})`;
}

// One extra row tells whether there's another page. The cursor is the raw
// database value (with its microseconds), so the next page starts exactly
// after the last row.
function page<Row extends { id: string }, T>(rows: Row[], limit: number, sortColumn: keyof Row, toResource: (row: Row) => T): List<T> {
  const hasMore = rows.length > limit;
  const shown = rows.slice(0, limit);
  const last = shown.at(-1);
  return {
    data: shown.map(toResource),
    hasMore,
    nextCursor: hasMore && last ? encodeCursor({ after: String(last[sortColumn]), id: last.id }) : null,
  };
}

// ------------------------------------------------------------------ bookings

// Bookings in the order they happen: starts_at, then id.
export async function listBookings(tenantId: string, p: BookingListParams): Promise<List<Booking>> {
  let q = createAdminClient()
    .from("bookings")
    .select(BOOKING_COLUMNS)
    .eq("tenant_id", tenantId)
    .in("status", p.status ?? VISIBLE_BOOKING_STATUSES);
  if (p.from) q = q.gte("starts_at", p.from);
  if (p.to) q = q.lt("starts_at", p.to);
  if (p.updatedSince) q = q.gte("updated_at", p.updatedSince);
  if (p.customerId) q = q.eq("customer_id", p.customerId);
  if (p.cursor) q = q.or(afterCursor("starts_at", true, p.cursor));
  const { data, error } = await q
    .order("starts_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(p.limit + 1)
    .returns<BookingRow[]>();
  if (error) throw error;
  return page(data, p.limit, "starts_at", bookingResource);
}

export async function getBooking(tenantId: string, id: string): Promise<Booking | null> {
  const { data, error } = await createAdminClient()
    .from("bookings")
    .select(BOOKING_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .in("status", VISIBLE_BOOKING_STATUSES)
    .maybeSingle<BookingRow>();
  if (error) throw error;
  return data ? bookingResource(data) : null;
}

// ------------------------------------------------------------------ leads

// Newest first: created_at, then id, both descending.
export async function listLeads(tenantId: string, p: LeadListParams): Promise<List<Lead>> {
  let q = createAdminClient().from("leads").select(LEAD_COLUMNS).eq("tenant_id", tenantId);
  if (p.status) q = q.in("status", p.status);
  if (p.source) q = q.eq("source", p.source);
  if (p.customerId) q = q.eq("customer_id", p.customerId);
  if (p.createdSince) q = q.gte("created_at", p.createdSince);
  if (p.updatedSince) q = q.gte("updated_at", p.updatedSince);
  if (p.cursor) q = q.or(afterCursor("created_at", false, p.cursor));
  const { data, error } = await q
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(p.limit + 1)
    .returns<LeadRow[]>();
  if (error) throw error;
  return page(data, p.limit, "created_at", leadResource);
}

async function leadRow(db: Db, tenantId: string, column: "id" | "external_id", value: string) {
  const { data, error } = await db.from("leads").select(LEAD_COLUMNS).eq("tenant_id", tenantId).eq(column, value).maybeSingle<LeadRow>();
  if (error) throw error;
  return data;
}

export async function getLead(tenantId: string, id: string): Promise<Lead | null> {
  const row = await leadRow(createAdminClient(), tenantId, "id", id);
  return row ? leadResource(row) : null;
}

// The customer for an enquiry: the same person if their email or phone is
// already known, otherwise a new one. Never opts anyone in to marketing: the
// form on someone else's website isn't ours to judge.
async function customerForLead(db: Db, tenantId: string, input: CreateLeadInput, retry = true): Promise<string> {
  for (const [column, value] of [["email", input.email], ["phone", input.phone]] as const) {
    if (!value) continue;
    const { data, error } = await db
      .from("customers")
      .select("id, email, phone, postcode")
      .eq("tenant_id", tenantId)
      .eq(column, value)
      .is("anonymised_at", null)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      const patch: Record<string, string> = {};
      if (!data.email && input.email) patch.email = input.email;
      if (!data.phone && input.phone) patch.phone = input.phone;
      if (!data.postcode && input.postcode) patch.postcode = input.postcode;
      if (Object.keys(patch).length) {
        const { error: updateError } = await db.from("customers").update(patch).eq("tenant_id", tenantId).eq("id", data.id);
        // 23505: that email or phone belongs to another customer; keep both.
        if (updateError && updateError.code !== "23505") throw updateError;
      }
      return data.id;
    }
  }
  const { data, error } = await db
    .from("customers")
    .insert({
      tenant_id: tenantId,
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      postcode: input.postcode ?? null,
      source: "website",
    })
    .select("id")
    .single();
  // Added by a parallel request between the lookup and the insert.
  if (error?.code === "23505" && retry) return customerForLead(db, tenantId, input, false);
  if (error) throw error;
  return data.id;
}

export type CreateLeadResult = { lead: Lead; created: boolean } | { error: "unknown_service" };

export async function createLead(tenantId: string, input: CreateLeadInput): Promise<CreateLeadResult> {
  const db = createAdminClient();
  const externalId = input.externalId ? API_EXTERNAL_PREFIX + input.externalId : null;
  if (externalId) {
    const seen = await leadRow(db, tenantId, "external_id", externalId);
    if (seen) return { lead: leadResource(seen), created: false };
  }

  let service: { id: string; name: string } | null = null;
  if (input.serviceId) {
    const { data, error } = await db.from("services").select("id, name").eq("tenant_id", tenantId).eq("id", input.serviceId).maybeSingle();
    if (error) throw error;
    if (!data) return { error: "unknown_service" };
    service = data;
  }

  const postcode = input.postcode?.toUpperCase().replace(/\s+/g, " ") || null;
  const customerId = await customerForLead(db, tenantId, { ...input, postcode: postcode ?? undefined });
  const answers = [...(input.message ? [{ question: "Message", answer: input.message }] : []), ...(input.answers ?? [])];

  const { data, error } = await db
    .from("leads")
    .insert({
      tenant_id: tenantId,
      customer_id: customerId,
      status: "new",
      source: "website",
      external_id: externalId,
      quote_snapshot: service || postcode ? { service_id: service?.id ?? null, service_name: service?.name ?? null, postcode } : null,
      form_answers: { form: input.formName ?? "Website form", ad: null, campaign: null, organic: null, answers },
    })
    .select(LEAD_COLUMNS)
    .single<LeadRow>();
  // The same externalId sent twice at once: return the one that won.
  if (error?.code === "23505" && externalId) {
    const seen = await leadRow(db, tenantId, "external_id", externalId);
    if (seen) return { lead: leadResource(seen), created: false };
  }
  if (error) throw error;

  await sendLeadWebhook(tenantId, data.id);
  return { lead: leadResource(data), created: true };
}

// ------------------------------------------------------------------ customers

export async function listCustomers(tenantId: string, p: CustomerListParams): Promise<List<Customer>> {
  let q = createAdminClient().from("customers").select(CUSTOMER_COLUMNS).eq("tenant_id", tenantId).is("anonymised_at", null);
  if (p.email) q = q.eq("email", p.email);
  if (p.phone) q = q.eq("phone", p.phone);
  if (p.updatedSince) q = q.gte("updated_at", p.updatedSince);
  if (p.cursor) q = q.or(afterCursor("created_at", false, p.cursor));
  const { data, error } = await q
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(p.limit + 1)
    .returns<CustomerRow[]>();
  if (error) throw error;
  return page(data, p.limit, "created_at", customerResource);
}

export async function getCustomer(tenantId: string, id: string): Promise<Customer | null> {
  const { data, error } = await createAdminClient()
    .from("customers")
    .select(CUSTOMER_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .is("anonymised_at", null)
    .maybeSingle<CustomerRow>();
  if (error) throw error;
  return data ? customerResource(data) : null;
}

// ------------------------------------------------------------------ webhooks

const WEBHOOK_COLUMNS = "id, url, description, events, active, created_at";
type WebhookRow = { id: string; url: string; description: string | null; events: string[]; active: boolean; created_at: string };

function webhookResource(w: WebhookRow): Webhook {
  return {
    id: w.id,
    url: w.url,
    description: w.description,
    events: w.events.filter(isWebhookEvent),
    active: w.active,
    createdAt: new Date(w.created_at).toISOString(),
  };
}

export async function listWebhooks(tenantId: string): Promise<Webhook[]> {
  const { data, error } = await createAdminClient()
    .from("webhook_endpoints")
    .select(WEBHOOK_COLUMNS)
    .eq("tenant_id", tenantId)
    .order("created_at")
    .returns<WebhookRow[]>();
  if (error) throw error;
  return data.map(webhookResource);
}

export async function getWebhook(tenantId: string, id: string): Promise<Webhook | null> {
  const { data, error } = await createAdminClient()
    .from("webhook_endpoints")
    .select(WEBHOOK_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle<WebhookRow>();
  if (error) throw error;
  return data ? webhookResource(data) : null;
}

export async function createWebhook(
  tenantId: string,
  input: { url: string; events: WebhookEventType[]; description?: string },
): Promise<{ webhook: Webhook; secret: string } | { error: string; code: "invalid_request" | "limit_reached" }> {
  const made = await createEndpoint(tenantId, null, { url: input.url, events: input.events, description: input.description ?? null });
  if ("error" in made) {
    return { error: made.error ?? "That webhook couldn't be added.", code: "limit" in made ? "limit_reached" : "invalid_request" };
  }
  const webhook = await getWebhook(tenantId, made.id);
  if (!webhook) throw new Error("The new webhook couldn't be read back.");
  return { webhook, secret: made.secret };
}

export async function deleteWebhook(tenantId: string, id: string) {
  if (!(await getWebhook(tenantId, id))) return false;
  await deleteEndpoint(tenantId, id);
  return true;
}
