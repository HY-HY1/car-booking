import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import type { SupabaseClient } from "@supabase/supabase-js";
import { bookingReference } from "../booking/confirmation";
import { seal, unseal } from "../calendar/crypto";
import { createAdminClient } from "../supabase/admin";
import {
  bookingEventFor,
  delivered,
  isPrivateAddress,
  MAX_ATTEMPTS,
  newSigningSecret,
  nextAttemptAt,
  sign,
  webhookUrlProblem,
  type WebhookEvent,
} from "./rules";

// Webhooks out (supabase/migrations/20261112120000_integrations.sql).
//
// sendBookingWebhooks and sendLeadWebhook are called where bookings and leads change.
// Each queues one delivery per endpoint that wants the event and tries it
// straight away; failures are retried by the next event for that business
// and by the daily job (runWebhookJobs). The hooks never throw: a business's
// server being down mustn't lose a booking.

type Db = SupabaseClient;

export const MAX_ENDPOINTS = 10;
const TIMEOUT_MS = 5_000;
// Paused after this many failures in a row; the owner switches it back on.
const PAUSE_AFTER = 50;
const KEEP_DAYS = 30;
// A booking first seen this soon after it was made is new.
const NEW_WITHIN_MS = 60 * 60_000;

const allowLocal = () => process.env.NODE_ENV !== "production";

async function quietly(label: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (error) {
    console.error(`[webhooks] ${label} failed`, error);
  }
}

// ------------------------------------------------------------------ payloads

type BookingRow = {
  id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  created_at: string;
  updated_at: string;
  location_type: string;
  address_line: string | null;
  postcode: string;
  customer_notes: string | null;
  price_pence: number;
  deposit_pence: number;
  deposit_status: string;
  source: string;
  resource_id: string | null;
  quote_snapshot: { lines?: { label: string; amount_pence: number }[] } | null;
  service: { id: string; name: string } | null;
  customer: { id: string; name: string; email: string | null; phone: string | null } | null;
  vehicle: { make: string | null; model: string | null; registration: string | null; size_class: string } | null;
  staff: { id: string; name: string } | null;
};

const BOOKING_COLUMNS =
  "id, status, starts_at, ends_at, created_at, updated_at, location_type, address_line, postcode, customer_notes, price_pence, deposit_pence, deposit_status, source, resource_id, quote_snapshot, service:services(id, name), customer:customers(id, name, email, phone), vehicle:vehicles(make, model, registration, size_class), staff:staff(id, name)";

// What's sent about a booking. Never the team's internal notes.
function bookingData(b: BookingRow) {
  return {
    id: b.id,
    reference: bookingReference(b.id),
    status: b.status,
    starts_at: b.starts_at,
    ends_at: b.ends_at,
    service: b.service,
    lines: b.quote_snapshot?.lines ?? [],
    price: { total_pence: b.price_pence, deposit_pence: b.deposit_pence, deposit_status: b.deposit_status },
    location: { type: b.location_type, address: b.address_line, postcode: b.postcode },
    customer: b.customer,
    vehicle: b.vehicle,
    notes: b.customer_notes,
    van_or_bay_id: b.resource_id,
    staff: b.staff,
    source: b.source,
    created_at: b.created_at,
    updated_at: b.updated_at,
  };
}

async function leadData(db: Db, tenantId: string, leadId: string) {
  const { data, error } = await db
    .from("leads")
    .select("id, status, source, created_at, quote_snapshot, form_answers, customer:customers(id, name, email, phone)")
    .eq("tenant_id", tenantId)
    .eq("id", leadId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const snapshot = data.quote_snapshot as { service_name?: string; total_pence?: number; postcode?: string } | null;
  return {
    id: data.id,
    status: data.status,
    source: data.source,
    service: snapshot?.service_name ?? null,
    quoted_pence: snapshot?.total_pence ?? null,
    postcode: snapshot?.postcode ?? null,
    form_answers: data.form_answers ?? null,
    customer: data.customer,
    created_at: data.created_at,
  };
}

// ------------------------------------------------------------------ queueing

type Endpoint = { id: string; url: string; secret: string; events: string[] };

async function activeEndpoints(db: Db, tenantId: string): Promise<Endpoint[]> {
  const { data, error } = await db
    .from("webhook_endpoints")
    .select("id, url, secret, events")
    .eq("tenant_id", tenantId)
    .eq("active", true);
  if (error) throw error;
  return data;
}

function envelope(type: string, data: unknown) {
  return { id: `evt_${randomUUID().replace(/-/g, "")}`, type, created_at: new Date().toISOString(), data };
}

async function queue(db: Db, tenantId: string, endpoints: Endpoint[], type: WebhookEvent, data: unknown) {
  const wanted = endpoints.filter((e) => e.events.includes(type));
  if (!wanted.length) return;
  const event = envelope(type, data);
  const { error } = await db.from("webhook_deliveries").insert(
    wanted.map((e) => ({ tenant_id: tenantId, endpoint_id: e.id, event_id: event.id, event_type: type, payload: event })),
  );
  if (error) throw error;
  await deliverDue(db, { tenantId, limit: 20 });
}

// Called wherever a booking changes. Works out what happened from what was
// last sent, so callers don't have to say.
export async function sendBookingWebhooks(tenantId: string, bookingId: string) {
  await quietly("booking event", async () => {
    const db = createAdminClient();
    const endpoints = await activeEndpoints(db, tenantId);
    if (!endpoints.length) return;

    const [booking, state] = await Promise.all([
      db.from("bookings").select(BOOKING_COLUMNS).eq("tenant_id", tenantId).eq("id", bookingId).maybeSingle<BookingRow>(),
      db.from("webhook_booking_state").select("status, starts_at").eq("booking_id", bookingId).maybeSingle(),
    ]);
    if (booking.error) throw booking.error;
    if (state.error) throw state.error;
    const b = booking.data;
    if (!b) return;

    const before = state.data ? { status: state.data.status, startsAt: state.data.starts_at } : null;
    const createdRecently = Date.now() - new Date(b.created_at).getTime() < NEW_WITHIN_MS;
    const type = bookingEventFor(before, { status: b.status, startsAt: b.starts_at }, { createdRecently });

    const saved = await db
      .from("webhook_booking_state")
      .upsert({ booking_id: b.id, tenant_id: tenantId, status: b.status, starts_at: b.starts_at, updated_at: new Date().toISOString() });
    if (saved.error) throw saved.error;
    if (type) await queue(db, tenantId, endpoints, type, { booking: bookingData(b) });
  });
}

// A new lead (not a returning customer's open one being updated).
export async function sendLeadWebhook(tenantId: string, leadId: string) {
  await quietly("lead event", async () => {
    const db = createAdminClient();
    const endpoints = await activeEndpoints(db, tenantId);
    if (!endpoints.some((e) => e.events.includes("lead.created"))) return;
    const lead = await leadData(db, tenantId, leadId);
    if (lead) await queue(db, tenantId, endpoints, "lead.created", { lead });
  });
}

// ------------------------------------------------------------------ sending

type Attempt = { status: number | null; body: string };

// Refuses to send anywhere on a private network, checked on what the name
// resolves to now (the address was checked as text when it was saved).
async function post(url: string, headers: Record<string, string>, body: string): Promise<Attempt> {
  const target = new URL(url);
  if (!allowLocal()) {
    const host = target.hostname.replace(/^\[|\]$/g, "");
    const addresses = await lookup(host, { all: true }).catch(() => []);
    if (!addresses.length) return { status: null, body: "The address couldn't be found (DNS)." };
    if (addresses.some((a) => isPrivateAddress(a.address))) {
      return { status: null, body: "The address points at a private network, so nothing was sent." };
    }
  }
  try {
    const res = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "BookingWebhooks/1", ...headers },
      body,
      // A redirect could point anywhere; the receiver should give its final address.
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const text = (await res.text().catch(() => "")).slice(0, 500);
    return { status: res.status, body: text };
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return { status: null, body: timedOut ? `No answer within ${TIMEOUT_MS / 1000} seconds.` : "Couldn't connect." };
  }
}

type DueRow = {
  id: string;
  tenant_id: string;
  event_id: string;
  payload: unknown;
  attempts: number;
  next_attempt_at: string;
  endpoint: { id: string; url: string; secret: string; active: boolean; consecutive_failures: number } | null;
};

async function attempt(db: Db, row: DueRow): Promise<Attempt> {
  const endpoint = row.endpoint;
  const now = new Date();
  if (!endpoint?.active) {
    await db.from("webhook_deliveries").update({ status: "failed", response_body: "The webhook was switched off." }).eq("id", row.id);
    return { status: null, body: "The webhook was switched off." };
  }
  const secret = unseal(endpoint.secret);
  const body = JSON.stringify(row.payload);
  const timestamp = Math.floor(now.getTime() / 1000);
  const result = secret
    ? await post(endpoint.url, {
        "Webhook-Id": row.event_id,
        "Webhook-Timestamp": String(timestamp),
        "Webhook-Signature": sign(secret, row.event_id, timestamp, body),
      }, body)
    : { status: null, body: "The signing secret can't be read any more. Roll the secret." };

  const ok = delivered(result.status);
  const attempts = row.attempts + 1;
  const next = ok ? null : nextAttemptAt(attempts, now);
  const failedForGood = !ok && (!next || attempts >= MAX_ATTEMPTS);
  const updated = await db
    .from("webhook_deliveries")
    .update({
      attempts,
      status: ok ? "delivered" : failedForGood ? "failed" : "pending",
      next_attempt_at: (next ?? now).toISOString(),
      response_status: result.status,
      response_body: result.body || null,
      delivered_at: ok ? now.toISOString() : null,
    })
    .eq("id", row.id);
  if (updated.error) throw updated.error;

  const failures = ok ? 0 : endpoint.consecutive_failures + 1;
  const ep = await db
    .from("webhook_endpoints")
    .update({
      last_delivery_at: now.toISOString(),
      last_status: result.status,
      consecutive_failures: failures,
      ...(failures >= PAUSE_AFTER && { active: false }),
    })
    .eq("id", endpoint.id);
  if (ep.error) throw ep.error;
  return result;
}

// Sends what's due, oldest first. Each row is claimed (its next try pushed
// back) before sending, so two runs at once don't both send it.
async function deliverDue(db: Db, opts: { tenantId?: string; limit: number; ids?: string[] }) {
  let q = db
    .from("webhook_deliveries")
    .select("id, tenant_id, event_id, payload, attempts, next_attempt_at, endpoint:webhook_endpoints(id, url, secret, active, consecutive_failures)")
    .eq("status", "pending")
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at")
    .limit(opts.limit);
  if (opts.tenantId) q = q.eq("tenant_id", opts.tenantId);
  if (opts.ids) q = q.in("id", opts.ids);
  const { data, error } = await q.returns<DueRow[]>();
  if (error) throw error;

  let sent = 0;
  let failed = 0;
  for (const row of data) {
    const claimed = await db
      .from("webhook_deliveries")
      .update({ next_attempt_at: new Date(Date.now() + 2 * 60_000).toISOString() })
      .eq("id", row.id)
      .eq("next_attempt_at", row.next_attempt_at)
      .select("id");
    if (claimed.error) throw claimed.error;
    if (!claimed.data.length) continue;
    const result = await attempt(db, row);
    if (delivered(result.status)) sent++;
    else failed++;
  }
  return { sent, failed };
}

// Daily (and whenever the job runs): retries what's due and clears out old
// deliveries, which hold customer details.
export async function runWebhookJobs() {
  const db = createAdminClient();
  const result = await deliverDue(db, { limit: 500 });
  const cutoff = new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString();
  const { error } = await db.from("webhook_deliveries").delete().lt("created_at", cutoff);
  if (error) throw error;
  return result;
}

// After a customer is erased: what was sent about them isn't kept here.
export async function forgetCustomerDeliveries(tenantId: string, customerId: string) {
  const db = createAdminClient();
  for (const path of ["data->booking->customer->>id", "data->lead->customer->>id"]) {
    const { error } = await db.from("webhook_deliveries").delete().eq("tenant_id", tenantId).eq(`payload->${path}`, customerId);
    if (error) throw error;
  }
}

// ------------------------------------------------------------------ managing

export type EndpointSummary = {
  id: string;
  url: string;
  description: string | null;
  events: string[];
  active: boolean;
  consecutiveFailures: number;
  lastDeliveryAt: string | null;
  lastStatus: number | null;
  createdAt: string;
  recent: {
    id: string;
    eventType: string;
    status: string;
    attempts: number;
    responseStatus: number | null;
    responseBody: string | null;
    createdAt: string;
    nextAttemptAt: string;
  }[];
};

export async function listEndpoints(tenantId: string): Promise<EndpointSummary[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("webhook_endpoints")
    .select("id, url, description, events, active, consecutive_failures, last_delivery_at, last_status, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at");
  if (error) throw error;
  if (!data.length) return [];
  const recent = await Promise.all(
    data.map((e) =>
      db
        .from("webhook_deliveries")
        .select("id, event_type, status, attempts, response_status, response_body, created_at, next_attempt_at")
        .eq("tenant_id", tenantId)
        .eq("endpoint_id", e.id)
        .order("created_at", { ascending: false })
        .limit(15),
    ),
  );
  return data.map((e, i) => {
    const r = recent[i];
    if (r.error) throw r.error;
    return {
      id: e.id,
      url: e.url,
      description: e.description,
      events: e.events,
      active: e.active,
      consecutiveFailures: e.consecutive_failures,
      lastDeliveryAt: e.last_delivery_at,
      lastStatus: e.last_status,
      createdAt: e.created_at,
      recent: r.data.map((d) => ({
        id: d.id,
        eventType: d.event_type,
        status: d.status,
        attempts: d.attempts,
        responseStatus: d.response_status,
        responseBody: d.response_body,
        createdAt: d.created_at,
        nextAttemptAt: d.next_attempt_at,
      })),
    };
  });
}

export type EndpointInput = { url: string; description: string | null; events: WebhookEvent[] };

export function endpointProblem(url: string) {
  return webhookUrlProblem(url, { allowLocal: allowLocal() });
}

// Returns the signing secret, which is shown once.
export async function createEndpoint(tenantId: string, userId: string, input: EndpointInput) {
  const problem = endpointProblem(input.url);
  if (problem) return { error: problem } as const;
  const db = createAdminClient();
  const count = await db.from("webhook_endpoints").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
  if (count.error) throw count.error;
  if ((count.count ?? 0) >= MAX_ENDPOINTS) return { error: `You can have up to ${MAX_ENDPOINTS} webhooks.` } as const;
  const secret = newSigningSecret(randomBytes(24));
  const { data, error } = await db
    .from("webhook_endpoints")
    .insert({ tenant_id: tenantId, created_by: userId, url: input.url.trim(), description: input.description, events: input.events, secret: seal(secret) })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id, secret } as const;
}

export async function updateEndpoint(tenantId: string, id: string, input: EndpointInput & { active: boolean }) {
  const problem = endpointProblem(input.url);
  if (problem) return { error: problem };
  const { error } = await createAdminClient()
    .from("webhook_endpoints")
    .update({
      url: input.url.trim(),
      description: input.description,
      events: input.events,
      active: input.active,
      // Switching it back on starts the count again.
      ...(input.active && { consecutive_failures: 0 }),
    })
    .eq("tenant_id", tenantId)
    .eq("id", id);
  if (error) throw error;
  return {};
}

export async function deleteEndpoint(tenantId: string, id: string) {
  const { error } = await createAdminClient().from("webhook_endpoints").delete().eq("tenant_id", tenantId).eq("id", id);
  if (error) throw error;
}

export async function rollSecret(tenantId: string, id: string) {
  const secret = newSigningSecret(randomBytes(24));
  const { data, error } = await createAdminClient()
    .from("webhook_endpoints")
    .update({ secret: seal(secret) })
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .select("id");
  if (error) throw error;
  return data.length ? secret : null;
}

// A "ping" event to check the address and the signature, sent now.
export async function sendTestEvent(tenantId: string, id: string) {
  const db = createAdminClient();
  const event = envelope("ping", { message: "A test from your booking dashboard. Nothing has happened to a booking." });
  const inserted = await db
    .from("webhook_deliveries")
    .insert({ tenant_id: tenantId, endpoint_id: id, event_id: event.id, event_type: "ping", payload: event, attempts: MAX_ATTEMPTS - 1 })
    .select("id")
    .single();
  if (inserted.error) throw inserted.error;
  await deliverDue(db, { tenantId, limit: 1, ids: [inserted.data.id] });
  const { data, error } = await db.from("webhook_deliveries").select("status, response_status, response_body").eq("id", inserted.data.id).single();
  if (error) throw error;
  return { ok: data.status === "delivered", status: data.response_status as number | null, body: data.response_body as string | null };
}

// Sends one delivery again now, whatever happened to it before.
export async function resendDelivery(tenantId: string, deliveryId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("webhook_deliveries")
    .update({ status: "pending", next_attempt_at: new Date().toISOString(), attempts: MAX_ATTEMPTS - 1 })
    .eq("tenant_id", tenantId)
    .eq("id", deliveryId)
    .select("id");
  if (error) throw error;
  if (!data.length) return false;
  await deliverDue(db, { tenantId, limit: 1, ids: [deliveryId] });
  return true;
}
