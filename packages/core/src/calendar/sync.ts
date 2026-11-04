import "server-only";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "../supabase/admin";
import { apiUrl, appUrl } from "../urls";
import { seal, unseal } from "./crypto";
import {
  bookingIdOf,
  busyFromEvents,
  changedInGoogle,
  EVENT_STATUSES,
  eventHash,
  eventIdFor,
  hasEvent,
  jobEvent,
  type GoogleEvent,
} from "./event";
import * as google from "./google";

// Two-way Google Calendar sync (supabase/migrations/20261102120000_google_calendar.sql).
//
// Out: syncBookingEvent is called wherever a booking's status changes, and
// writes, rewrites or deletes its event. The daily job (runCalendarJobs)
// catches anything missed and retries what failed.
// In: each calendar in use is read into calendar_busy when Google says it
// changed (handleCalendarPush), when a slot lookup finds it stale
// (calendarBusyByResource), and daily. Jobs moved or deleted in Google are
// put back.
//
// The exported hooks never throw: Google being down mustn't lose a booking.

type Db = SupabaseClient;

const DEFAULT_TIMEZONE = "Europe/London";
const DAY_MS = 86_400_000;
// Read for busy times: a week back (for the diary) to the end of the booking window.
const READ_BACK_DAYS = 7;
const MAX_READ_AHEAD_DAYS = 400;
// Without a push channel (no https address, e.g. on this machine) a slot
// lookup rereads a calendar this often; with one, as a safety net.
const STALE_MS = 10 * 60_000;
const STALE_WITH_PUSH_MS = 6 * 60 * 60_000;
// Renew a push channel this close to its end. Google keeps them a week at most.
const CHANNEL_DAYS = 7;
const RENEW_WITHIN_MS = 2 * DAY_MS;

class NeedsReconnect extends Error {}

const short = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 500);

async function quietly<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    // Already recorded on the connection, and shown in the dashboard.
    if (!(error instanceof NeedsReconnect)) console.error(`[calendar] ${label} failed`, error);
    return undefined;
  }
}

// A few Google calls at a time.
async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(size, queue.length) }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) await fn(item);
    }),
  );
}

const chunks = <T>(items: T[], size = 100) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));

// ------------------------------------------------------------- connection

type ConnectionRow = {
  refresh_token: string;
  access_token: string | null;
  access_token_expires_at: string | null;
  default_calendar_id: string;
  status: string;
};

async function markReconnect(db: Db, tenantId: string, message: string) {
  const { error } = await db
    .from("calendar_connections")
    .update({ status: "needs_reconnect", last_error: message, access_token: null, access_token_expires_at: null })
    .eq("tenant_id", tenantId);
  if (error) console.error("[calendar] marking reconnect failed", error);
}

async function accessTokenFor(db: Db, tenantId: string, conn: ConnectionRow): Promise<string> {
  const expires = conn.access_token_expires_at ? new Date(conn.access_token_expires_at).getTime() : 0;
  if (conn.access_token && expires > Date.now() + 2 * 60_000) {
    const token = unseal(conn.access_token);
    if (token) return token;
  }
  const refresh = unseal(conn.refresh_token);
  if (!refresh) {
    await markReconnect(db, tenantId, "The saved Google sign-in can't be read any more. Connect Google again.");
    throw new NeedsReconnect();
  }
  try {
    const fresh = await google.refreshAccessToken(refresh);
    const { error } = await db
      .from("calendar_connections")
      .update({ access_token: seal(fresh.accessToken), access_token_expires_at: fresh.expiresAt.toISOString() })
      .eq("tenant_id", tenantId);
    if (error) throw error;
    return fresh.accessToken;
  } catch (error) {
    if (error instanceof google.GoogleError && error.reason === "invalid_grant") {
      await markReconnect(db, tenantId, "Google ended the connection (access removed, password changed, or it expired).");
      throw new NeedsReconnect();
    }
    throw error;
  }
}

type Ctx = {
  db: Db;
  tenantId: string;
  slug: string;
  timeZone: string;
  maxDaysAhead: number;
  calendarOf: (resourceId: string | null) => string;
  resourceName: Map<string, string>;
  // The calendars the vans and bays taking bookings use.
  activeCalendars: string[];
  token: () => Promise<string>;
};

// Everything needed to sync one business, or null if it hasn't connected
// Google (or has to connect again).
async function contextFor(db: Db, tenantId: string): Promise<Ctx | null> {
  const conn = await db
    .from("calendar_connections")
    .select("refresh_token, access_token, access_token_expires_at, default_calendar_id, status")
    .eq("tenant_id", tenantId)
    .maybeSingle<ConnectionRow>();
  if (conn.error) throw conn.error;
  if (!conn.data || conn.data.status !== "active") return null;
  const row = conn.data;

  const [tenant, settings, resources] = await Promise.all([
    db.from("tenants").select("slug").eq("id", tenantId).single(),
    db.from("booking_settings").select("timezone, max_days_ahead").eq("tenant_id", tenantId).maybeSingle(),
    db.from("resources").select("id, name, calendar_id, active").eq("tenant_id", tenantId),
  ]);
  if (tenant.error) throw tenant.error;
  if (settings.error) throw settings.error;
  if (resources.error) throw resources.error;

  const own = new Map(resources.data.map((r) => [r.id as string, (r.calendar_id as string | null) ?? null]));
  const calendarOf = (resourceId: string | null) => (resourceId && own.get(resourceId)) || row.default_calendar_id;
  const active = resources.data.filter((r) => r.active);
  let token: Promise<string> | undefined;

  return {
    db,
    tenantId,
    slug: tenant.data.slug,
    timeZone: settings.data?.timezone ?? DEFAULT_TIMEZONE,
    maxDaysAhead: settings.data?.max_days_ahead ?? 60,
    calendarOf,
    resourceName: new Map(resources.data.map((r) => [r.id as string, r.name as string])),
    activeCalendars: [...new Set(active.length ? active.map((r) => calendarOf(r.id)) : [row.default_calendar_id])],
    token: () => (token ??= accessTokenFor(db, tenantId, row)),
  };
}

// ------------------------------------------------------------- bookings → Google

const BOOKING_FIELDS =
  "id, status, starts_at, ends_at, resource_id, location_type, address_line, postcode, customer_notes, quote_snapshot, price_pence, deposit_pence, deposit_status, customer:customers(name, phone, email), service:services(name), vehicle:vehicles(make, model, registration)";

type BookingRow = {
  id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  resource_id: string | null;
  location_type: string;
  address_line: string | null;
  postcode: string | null;
  customer_notes: string | null;
  quote_snapshot: unknown;
  price_pence: number;
  deposit_pence: number;
  deposit_status: string;
  customer: { name: string | null; phone: string | null; email: string | null } | null;
  service: { name: string } | null;
  vehicle: { make: string | null; model: string | null; registration: string | null } | null;
};

type EventRow = {
  booking_id: string;
  calendar_id: string;
  event_id: string;
  written_hash: string | null;
  sync_error: string | null;
};

// Makes each booking's event match the booking. `restore` holds the ones
// changed in Google: they're rewritten even if nothing changed here.
async function syncBookings(ctx: Ctx, ids: string[], restore = new Set<string>()) {
  const { db, tenantId } = ctx;
  for (const batch of chunks([...new Set(ids)])) {
    const [bookings, rows] = await Promise.all([
      db.from("bookings").select(BOOKING_FIELDS).eq("tenant_id", tenantId).in("id", batch),
      db
        .from("calendar_events")
        .select("booking_id, calendar_id, event_id, written_hash, sync_error")
        .eq("tenant_id", tenantId)
        .in("booking_id", batch),
    ]);
    if (bookings.error) throw bookings.error;
    if (rows.error) throw rows.error;
    const byId = new Map((bookings.data as unknown as BookingRow[]).map((b) => [b.id, b]));
    const rowOf = new Map((rows.data as EventRow[]).map((r) => [r.booking_id, r]));

    await pool(batch, 4, async (id) => {
      const b = byId.get(id);
      const row = rowOf.get(id);

      if (!b || !hasEvent(b.status)) {
        if (!row) return;
        try {
          await google.deleteEvent(await ctx.token(), row.calendar_id, row.event_id);
          const { error } = await db.from("calendar_events").delete().eq("tenant_id", tenantId).eq("booking_id", id);
          if (error) throw error;
        } catch (error) {
          if (error instanceof NeedsReconnect) throw error;
          console.error("[calendar] removing an event failed", error);
          await db.from("calendar_events").update({ sync_error: short(error) }).eq("tenant_id", tenantId).eq("booking_id", id);
        }
        return;
      }

      const calendarId = ctx.calendarOf(b.resource_id);
      const body = jobEvent({
        bookingId: b.id,
        status: b.status,
        startsAt: b.starts_at,
        endsAt: b.ends_at,
        timeZone: ctx.timeZone,
        service: b.service?.name ?? null,
        customer: b.customer,
        vehicle: b.vehicle,
        locationType: b.location_type,
        addressLine: b.address_line,
        postcode: b.postcode,
        resourceName: ctx.resourceName.size > 1 && b.resource_id ? (ctx.resourceName.get(b.resource_id) ?? null) : null,
        customerNotes: b.customer_notes,
        quoteSnapshot: b.quote_snapshot,
        pricePence: b.price_pence,
        depositPence: b.deposit_pence,
        depositStatus: b.deposit_status,
        link: appUrl(`/${ctx.slug}/bookings/${b.id}`, { absolute: true }),
      });
      const hash = eventHash(calendarId, body);
      const restoring = restore.has(id);
      if (row && row.written_hash === hash && !row.sync_error && !restoring) return;

      // Same calendar: keep its event. Moved to another van's calendar: start afresh there.
      const eventId = row && row.calendar_id === calendarId ? row.event_id : eventIdFor(id);
      const base = { booking_id: id, tenant_id: tenantId, calendar_id: calendarId };
      try {
        const token = await ctx.token();
        if (row && row.calendar_id !== calendarId) await google.deleteEvent(token, row.calendar_id, row.event_id);
        const written = await google.upsertEvent(token, calendarId, eventId, body);
        if (!written) throw new Error("That calendar has gone, or this Google account can no longer add to it.");
        const { error } = await db.from("calendar_events").upsert({
          ...base,
          event_id: written,
          written_hash: hash,
          synced_at: new Date().toISOString(),
          sync_error: null,
          ...(restoring && { changed_in_google_at: new Date().toISOString() }),
        });
        if (error) throw error;
      } catch (error) {
        if (error instanceof NeedsReconnect) throw error;
        console.error("[calendar] writing an event failed", error);
        await db
          .from("calendar_events")
          .upsert({ ...base, event_id: eventId, written_hash: null, sync_error: short(error) });
      }
    });
  }
}

// Called wherever a booking is secured, approved, declined, cancelled, done,
// a no-show or put back.
export async function syncBookingEvent(tenantId: string, bookingId: string) {
  await quietly("booking event", async () => {
    const db = createAdminClient();
    const ctx = await contextFor(db, tenantId);
    if (ctx) await syncBookings(ctx, [bookingId]);
  });
}

// After a customer is erased: their events are rewritten without them.
export async function syncCustomerEvents(tenantId: string, customerId: string) {
  await quietly("erased customer's events", async () => {
    const db = createAdminClient();
    const ctx = await contextFor(db, tenantId);
    if (!ctx) return;
    const { data, error } = await db
      .from("calendar_events")
      .select("booking_id, booking:bookings!inner(customer_id)")
      .eq("tenant_id", tenantId)
      .eq("booking.customer_id", customerId);
    if (error) throw error;
    await syncBookings(ctx, data.map((r) => r.booking_id as string));
  });
}

// Every booking from yesterday on that should have an event, or has one.
async function syncUpcoming(ctx: Ctx) {
  const since = new Date(Date.now() - DAY_MS).toISOString();
  const [live, written] = await Promise.all([
    ctx.db
      .from("bookings")
      .select("id")
      .eq("tenant_id", ctx.tenantId)
      .in("status", [...EVENT_STATUSES])
      .gte("starts_at", since)
      .order("starts_at")
      .limit(1000),
    ctx.db
      .from("calendar_events")
      .select("booking_id, booking:bookings!inner(starts_at)")
      .eq("tenant_id", ctx.tenantId)
      .gte("booking.starts_at", since)
      .limit(1000),
  ]);
  if (live.error) throw live.error;
  if (written.error) throw written.error;
  await syncBookings(ctx, [...live.data.map((b) => b.id as string), ...written.data.map((r) => r.booking_id as string)]);
}

// ------------------------------------------------------------- Google → busy times

function readWindow(ctx: Pick<Ctx, "maxDaysAhead">) {
  const now = Date.now();
  const ahead = Math.min(Math.max(ctx.maxDaysAhead, 1) + 2, MAX_READ_AHEAD_DAYS);
  return { from: new Date(now - READ_BACK_DAYS * DAY_MS), to: new Date(now + ahead * DAY_MS) };
}

async function recordFeed(db: Db, tenantId: string, calendarId: string, fields: Record<string, unknown>) {
  const { error } = await db.from("calendar_feeds").update(fields).eq("tenant_id", tenantId).eq("calendar_id", calendarId);
  if (error) console.error("[calendar] updating a feed failed", error);
}

// Rereads one calendar: its busy times replace the stored ones, and any job
// someone moved or deleted there is put back.
async function refreshFeed(ctx: Ctx, calendarId: string) {
  const { db, tenantId } = ctx;
  try {
    const { from, to } = readWindow(ctx);
    const listed = await google.listEvents(await ctx.token(), calendarId, from, to);
    if (!listed) {
      await recordFeed(db, tenantId, calendarId, {
        synced_at: new Date().toISOString(),
        sync_error: "That calendar has gone, or this Google account can no longer see it.",
      });
      return;
    }

    const busy = busyFromEvents(listed.items, listed.timeZone ?? ctx.timeZone);
    const replaced = await db.rpc("replace_calendar_busy", {
      p_tenant: tenantId,
      p_calendar: calendarId,
      p_from: from.toISOString(),
      p_to: to.toISOString(),
      p_rows: busy,
    });
    if (replaced.error) throw replaced.error;

    await restoreChangedJobs(ctx, calendarId, listed.items);
    await recordFeed(db, tenantId, calendarId, { synced_at: new Date().toISOString(), sync_error: null });
  } catch (error) {
    if (error instanceof NeedsReconnect) throw error;
    console.error("[calendar] reading a calendar failed", error);
    await recordFeed(db, tenantId, calendarId, { synced_at: new Date().toISOString(), sync_error: short(error) });
  }
}

async function restoreChangedJobs(ctx: Ctx, calendarId: string, items: GoogleEvent[]) {
  const ours = new Map<string, GoogleEvent>();
  for (const e of items) {
    const id = bookingIdOf(e);
    if (id) ours.set(id, e);
  }
  if (ours.size === 0) return;

  const changed: string[] = [];
  for (const batch of chunks([...ours.keys()])) {
    const { data, error } = await ctx.db
      .from("calendar_events")
      .select("booking_id, event_id, booking:bookings!inner(starts_at, ends_at)")
      .eq("tenant_id", ctx.tenantId)
      .eq("calendar_id", calendarId)
      .in("booking_id", batch);
    if (error) throw error;
    for (const row of data as unknown as { booking_id: string; event_id: string; booking: { starts_at: string; ends_at: string } }[]) {
      const event = ours.get(row.booking_id);
      if (event?.id !== row.event_id) continue;
      if (changedInGoogle(event, { startsAt: row.booking.starts_at, endsAt: row.booking.ends_at })) changed.push(row.booking_id);
    }
  }
  if (changed.length) await syncBookings(ctx, changed, new Set(changed));
}

function webhookAddress() {
  const address = apiUrl("/webhooks/google-calendar", { absolute: true });
  // Google only calls https addresses, so not this machine.
  return address.startsWith("https://") ? address : null;
}

type FeedRow = {
  calendar_id: string;
  channel_id: string | null;
  channel_resource_id: string | null;
  channel_expires_at: string | null;
  synced_at: string | null;
};

// A push channel for the calendar, renewed before it runs out.
async function ensureChannel(ctx: Ctx, feed: FeedRow) {
  const address = webhookAddress();
  if (!address) return;
  if (feed.channel_expires_at && new Date(feed.channel_expires_at).getTime() > Date.now() + RENEW_WITHIN_MS) return;

  const token = await ctx.token();
  if (feed.channel_id && feed.channel_resource_id) {
    await quietly("stopping an old channel", () =>
      google.stopChannel(token, { id: feed.channel_id!, resourceId: feed.channel_resource_id! }),
    );
  }
  const channel = { id: randomUUID(), token: randomBytes(24).toString("hex") };
  try {
    const watched = await google.watchEvents(token, feed.calendar_id, {
      ...channel,
      address,
      expiresAt: new Date(Date.now() + CHANNEL_DAYS * DAY_MS),
    });
    await recordFeed(ctx.db, ctx.tenantId, feed.calendar_id, {
      channel_id: watched ? channel.id : null,
      channel_token: watched ? channel.token : null,
      channel_resource_id: watched?.resourceId ?? null,
      channel_expires_at: watched?.expiresAt.toISOString() ?? null,
    });
  } catch (error) {
    if (error instanceof NeedsReconnect) throw error;
    console.error("[calendar] watching a calendar failed", error);
    await recordFeed(ctx.db, ctx.tenantId, feed.calendar_id, { channel_id: null, channel_token: null, channel_expires_at: null });
  }
}

async function stopFeed(ctx: Ctx, feed: FeedRow) {
  if (feed.channel_id && feed.channel_resource_id) {
    const token = await ctx.token();
    await quietly("stopping a channel", () =>
      google.stopChannel(token, { id: feed.channel_id!, resourceId: feed.channel_resource_id! }),
    );
  }
  const [busy, row] = await Promise.all([
    ctx.db.from("calendar_busy").delete().eq("tenant_id", ctx.tenantId).eq("calendar_id", feed.calendar_id),
    ctx.db.from("calendar_feeds").delete().eq("tenant_id", ctx.tenantId).eq("calendar_id", feed.calendar_id),
  ]);
  if (busy.error) throw busy.error;
  if (row.error) throw row.error;
}

// Feeds for exactly the calendars in use: new ones added, ones no van uses
// any more stopped and their busy times dropped.
async function ensureFeeds(ctx: Ctx): Promise<FeedRow[]> {
  const FEED_FIELDS = "calendar_id, channel_id, channel_resource_id, channel_expires_at, synced_at";
  const existing = await ctx.db.from("calendar_feeds").select(FEED_FIELDS).eq("tenant_id", ctx.tenantId);
  if (existing.error) throw existing.error;
  const wanted = new Set(ctx.activeCalendars);
  for (const feed of existing.data as FeedRow[]) if (!wanted.has(feed.calendar_id)) await stopFeed(ctx, feed);

  const have = new Set((existing.data as FeedRow[]).map((f) => f.calendar_id));
  const missing = ctx.activeCalendars.filter((c) => !have.has(c));
  if (missing.length) {
    const { error } = await ctx.db
      .from("calendar_feeds")
      .insert(missing.map((calendar_id) => ({ tenant_id: ctx.tenantId, calendar_id })));
    if (error && error.code !== "23505") throw error;
  }
  const feeds = await ctx.db.from("calendar_feeds").select(FEED_FIELDS).eq("tenant_id", ctx.tenantId);
  if (feeds.error) throw feeds.error;
  return feeds.data as FeedRow[];
}

// Everything for one business: feeds and push channels, every calendar
// reread, and every upcoming booking's event checked.
export async function reconcileCalendar(tenantId: string): Promise<"synced" | "not_connected" | "needs_reconnect" | "failed"> {
  const db = createAdminClient();
  try {
    const ctx = await contextFor(db, tenantId);
    if (!ctx) return "not_connected";
    const feeds = await ensureFeeds(ctx);
    for (const feed of feeds) {
      await ensureChannel(ctx, feed);
      await refreshFeed(ctx, feed.calendar_id);
    }
    await syncUpcoming(ctx);
    return "synced";
  } catch (error) {
    if (error instanceof NeedsReconnect) return "needs_reconnect";
    console.error("[calendar] syncing a business failed", error);
    return "failed";
  }
}

// Rereads the business's stale calendars, waiting at most `budgetMs` (a
// customer is waiting for times). Each feed is claimed first, so a burst of
// lookups reads Google once.
async function refreshStaleFeeds(db: Db, tenantId: string, budgetMs: number) {
  const { data, error } = await db
    .from("calendar_feeds")
    .select("id, calendar_id, synced_at, channel_expires_at")
    .eq("tenant_id", tenantId);
  if (error) throw error;
  const now = Date.now();
  const stale = data.filter((f) => {
    const pushed = f.channel_expires_at && new Date(f.channel_expires_at).getTime() > now;
    return !f.synced_at || now - new Date(f.synced_at).getTime() > (pushed ? STALE_WITH_PUSH_MS : STALE_MS);
  });
  if (stale.length === 0) return;

  const work = (async () => {
    const claimed: string[] = [];
    for (const f of stale) {
      let claim = db.from("calendar_feeds").update({ synced_at: new Date().toISOString() }).eq("id", f.id);
      claim = f.synced_at ? claim.eq("synced_at", f.synced_at) : claim.is("synced_at", null);
      const { data: won } = await claim.select("id");
      if (won?.length) claimed.push(f.calendar_id);
    }
    if (claimed.length === 0) return;
    const ctx = await contextFor(db, tenantId);
    if (!ctx) return;
    for (const calendarId of claimed) await refreshFeed(ctx, calendarId);
  })().catch((err) => {
    if (!(err instanceof NeedsReconnect)) console.error("[calendar] refreshing busy times failed", err);
  });
  await Promise.race([work, new Promise((resolve) => setTimeout(resolve, budgetMs))]);
}

// Busy times from Google for each van or bay, for availability. Nothing if
// the business hasn't connected Google. Busy times already read still count
// while the connection needs reconnecting. Never throws: a calendar problem
// mustn't stop customers seeing times.
export async function calendarBusyByResource(
  db: Db,
  tenantId: string,
  resourceIds: string[],
  from: Date,
  to: Date,
): Promise<Map<string, { start: Date; end: Date }[]>> {
  return (await quietly("busy times", () => readBusy(db, tenantId, resourceIds, from, to))) ?? new Map();
}

async function readBusy(db: Db, tenantId: string, resourceIds: string[], from: Date, to: Date) {
  const out = new Map<string, { start: Date; end: Date }[]>();
  const conn = await db.from("calendar_connections").select("default_calendar_id").eq("tenant_id", tenantId).maybeSingle();
  if (conn.error) throw conn.error;
  if (!conn.data || resourceIds.length === 0) return out;

  await quietly("stale calendar check", () => refreshStaleFeeds(db, tenantId, 2_500));

  const [resources, busy] = await Promise.all([
    db.from("resources").select("id, calendar_id").eq("tenant_id", tenantId).in("id", resourceIds),
    db
      .from("calendar_busy")
      .select("calendar_id, starts_at, ends_at")
      .eq("tenant_id", tenantId)
      .lt("starts_at", to.toISOString())
      .gt("ends_at", from.toISOString())
      .limit(5000),
  ]);
  if (resources.error) throw resources.error;
  if (busy.error) throw busy.error;

  const byCalendar = new Map<string, { start: Date; end: Date }[]>();
  for (const b of busy.data) {
    const list = byCalendar.get(b.calendar_id) ?? [];
    list.push({ start: new Date(b.starts_at), end: new Date(b.ends_at) });
    byCalendar.set(b.calendar_id, list);
  }
  for (const r of resources.data) {
    out.set(r.id, byCalendar.get(r.calendar_id ?? conn.data.default_calendar_id) ?? []);
  }
  return out;
}

const sameSecret = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

// Google saying a watched calendar changed. False if the channel isn't ours.
export async function handleCalendarPush(push: { channelId: string | null; token: string | null; state: string | null }) {
  if (!push.channelId || !push.token || !/^[0-9a-f-]{36}$/i.test(push.channelId)) return false;
  const db = createAdminClient();
  const { data: feed, error } = await db
    .from("calendar_feeds")
    .select("tenant_id, calendar_id, channel_token")
    .eq("channel_id", push.channelId)
    .maybeSingle();
  if (error) throw error;
  if (!feed?.channel_token || !sameSecret(push.token, feed.channel_token)) return false;
  // "sync" is Google confirming a new channel; nothing has changed yet.
  if (push.state === "sync") return true;

  await quietly("push", async () => {
    const ctx = await contextFor(db, feed.tenant_id);
    if (ctx) await refreshFeed(ctx, feed.calendar_id);
  });
  return true;
}

// The daily job: renews push channels, rereads every calendar, and retries
// any event that failed to write.
export async function runCalendarJobs() {
  const db = createAdminClient();
  const { data, error } = await db.from("calendar_connections").select("tenant_id").eq("status", "active");
  if (error) throw error;
  const results: Record<string, number> = {};
  for (const { tenant_id } of data) {
    const result = await reconcileCalendar(tenant_id);
    results[result] = (results[result] ?? 0) + 1;
  }
  return results;
}

// ------------------------------------------------------------- connecting

export type ConnectResult = { ok: true } | { ok: false; reason: "missing_scope" };

// Saves the Google account a business has just connected. A different
// account from before starts clean: the old account's calendars and events
// aren't this one's.
export async function saveCalendarConnection(
  tenantId: string,
  userId: string,
  tokens: google.Tokens,
): Promise<ConnectResult> {
  // Google lets people untick calendar access on its consent screen.
  if (!tokens.scopes.includes("https://www.googleapis.com/auth/calendar.events")) {
    await quietly("revoking a partial grant", () => google.revokeToken(tokens.refreshToken));
    return { ok: false, reason: "missing_scope" };
  }
  const db = createAdminClient();
  const existing = await db.from("calendar_connections").select("account_email").eq("tenant_id", tenantId).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data && existing.data.account_email !== tokens.email) await disconnectCalendar(tenantId);

  const { error } = await db.from("calendar_connections").upsert(
    {
      tenant_id: tenantId,
      provider: "google",
      account_email: tokens.email,
      refresh_token: seal(tokens.refreshToken),
      access_token: seal(tokens.accessToken),
      access_token_expires_at: tokens.expiresAt.toISOString(),
      status: "active",
      last_error: null,
      connected_by: userId,
    },
    { onConflict: "tenant_id" },
  );
  if (error) throw error;
  return { ok: true };
}

// Stops syncing: upcoming job events come out of Google (past ones stay, as
// a record), push channels stop, Google access is revoked and everything
// read from the calendar is deleted.
export async function disconnectCalendar(tenantId: string) {
  const db = createAdminClient();
  const conn = await db
    .from("calendar_connections")
    .select("refresh_token, access_token, access_token_expires_at, default_calendar_id, status")
    .eq("tenant_id", tenantId)
    .maybeSingle<ConnectionRow>();
  if (conn.error) throw conn.error;
  if (!conn.data) return;

  const token = await quietly("token for disconnecting", () => accessTokenFor(db, tenantId, conn.data!));
  if (token) {
    const [feeds, upcoming] = await Promise.all([
      db.from("calendar_feeds").select("channel_id, channel_resource_id").eq("tenant_id", tenantId),
      db
        .from("calendar_events")
        .select("calendar_id, event_id, booking:bookings!inner(starts_at)")
        .eq("tenant_id", tenantId)
        .gte("booking.starts_at", new Date().toISOString())
        .limit(500),
    ]);
    for (const f of feeds.data ?? []) {
      if (f.channel_id && f.channel_resource_id) {
        await quietly("stopping a channel", () => google.stopChannel(token, { id: f.channel_id, resourceId: f.channel_resource_id }));
      }
    }
    await pool(upcoming.data ?? [], 4, async (e) => {
      await quietly("removing an event", () => google.deleteEvent(token, e.calendar_id, e.event_id));
    });
  }
  const refresh = unseal(conn.data.refresh_token);
  if (refresh) await quietly("revoking access", () => google.revokeToken(refresh));

  for (const table of ["calendar_events", "calendar_busy", "calendar_feeds", "calendar_connections"]) {
    const { error } = await db.from(table).delete().eq("tenant_id", tenantId);
    if (error) throw error;
  }
  const { error } = await db.from("resources").update({ calendar_id: null }).eq("tenant_id", tenantId);
  if (error) throw error;
}

// ------------------------------------------------------------- settings

export type CalendarSettings = {
  connection: {
    email: string | null;
    status: "active" | "needs_reconnect";
    lastError: string | null;
    defaultCalendarId: string;
  } | null;
  // Null when Google couldn't be asked just now.
  calendars: google.GoogleCalendar[] | null;
  resources: { id: string; name: string; calendarId: string | null; active: boolean }[];
  // Jobs whose event couldn't be written last time.
  failing: number;
};

// The primary calendar is stored as "primary", whatever its id.
function normalise(calendarId: string, calendars: google.GoogleCalendar[]) {
  return calendars.find((c) => c.id === calendarId)?.primary ? "primary" : calendarId;
}

export async function loadCalendarSettings(tenantId: string): Promise<CalendarSettings> {
  const db = createAdminClient();
  const [conn, resources, failing] = await Promise.all([
    db
      .from("calendar_connections")
      .select("account_email, status, last_error, default_calendar_id, refresh_token, access_token, access_token_expires_at")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    db.from("resources").select("id, name, calendar_id, active").eq("tenant_id", tenantId).order("sort_order").order("created_at"),
    db.from("calendar_events").select("booking_id", { count: "exact", head: true }).eq("tenant_id", tenantId).not("sync_error", "is", null),
  ]);
  if (conn.error) throw conn.error;
  if (resources.error) throw resources.error;

  let calendars: google.GoogleCalendar[] | null = null;
  if (conn.data?.status === "active") {
    calendars =
      (await quietly("listing calendars", async () =>
        (await google.listCalendars(await accessTokenFor(db, tenantId, conn.data as ConnectionRow))).map((c) =>
          c.primary ? { ...c, id: "primary" } : c,
        ),
      )) ?? null;
  }
  // Reading the token may just have found the connection dead.
  const status = calendars === null && conn.data ? await db.from("calendar_connections").select("status, last_error").eq("tenant_id", tenantId).maybeSingle() : null;

  return {
    connection: conn.data
      ? {
          email: conn.data.account_email,
          status: (status?.data?.status ?? conn.data.status) as "active" | "needs_reconnect",
          lastError: status?.data?.last_error ?? conn.data.last_error,
          defaultCalendarId: conn.data.default_calendar_id,
        }
      : null,
    calendars,
    resources: resources.data.map((r) => ({ id: r.id, name: r.name, calendarId: r.calendar_id, active: r.active })),
    failing: failing.count ?? 0,
  };
}

// Which calendar the business uses, and any van or bay with its own. Each
// has to be one this Google account can add events to. Then everything is
// synced to match.
export async function saveCalendarChoices(
  tenantId: string,
  choices: { defaultCalendarId: string; byResource: Record<string, string | null> },
): Promise<{ error?: string }> {
  const db = createAdminClient();
  const ctx = await contextFor(db, tenantId);
  if (!ctx) return { error: "Connect Google Calendar first." };
  let calendars: google.GoogleCalendar[];
  try {
    calendars = await google.listCalendars(await ctx.token());
  } catch (error) {
    if (error instanceof NeedsReconnect) return { error: "Google ended the connection. Connect it again." };
    console.error("[calendar] listing calendars failed", error);
    return { error: "Couldn't reach Google just now. Try again." };
  }
  const usable = (id: string) => id === "primary" || calendars.some((c) => c.id === id);
  if (!usable(choices.defaultCalendarId)) return { error: "Pick one of your calendars." };
  for (const id of Object.values(choices.byResource)) {
    if (id && !usable(id)) return { error: "Pick one of your calendars for each van." };
  }

  const conn = await db
    .from("calendar_connections")
    .update({ default_calendar_id: normalise(choices.defaultCalendarId, calendars) })
    .eq("tenant_id", tenantId);
  if (conn.error) throw conn.error;
  for (const [resourceId, calendarId] of Object.entries(choices.byResource)) {
    const { error } = await db
      .from("resources")
      .update({ calendar_id: calendarId ? normalise(calendarId, calendars) : null })
      .eq("tenant_id", tenantId)
      .eq("id", resourceId);
    if (error) throw error;
  }
  return {};
}
