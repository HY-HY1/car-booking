import "server-only";
import { isCustomHostname } from "../tenants";
import { priceLabel } from "../billing/rules";
import { subscriptionPriceId } from "../billing/subscriptions";
import { closureDate } from "../settings/account";
import { getStripe } from "../stripe/client";
import { createAdminClient } from "../supabase/admin";
import { formatShortDate } from "../dates";
import { allRows, check } from "./query";
import {
  countByWeek,
  monthlyPence,
  planGroup,
  sortAttention,
  trialEndsSoon,
  weekBuckets,
  type AttentionItem,
  type PlanGroup,
} from "./overview-rules";

// The platform admin's home page: how many businesses there are and what
// they pay, what's happening across all of them, and what needs looking at.
// Uses the secret key; the caller has checked requirePlatformAdmin().

const DAY = 86_400_000;
const WEEKS = 12;

export type Pair = { current: number; previous: number };

export type PlatformOverview = {
  total: number;
  plans: Record<PlanGroup, number>;
  // From the subscription's list price; null if Stripe or the price isn't set up.
  mrr: { pence: number; paying: number; priceLabel: string } | null;
  signups: Pair;
  bookings: Pair;
  bookingValuePence: Pair;
  leads: Pair;
  weeks: { label: string; fullLabel: string; signups: number; bookings: number }[];
  attention: AttentionItem[];
  recentSignups: { name: string; slug: string; createdAt: string; status: string | null }[];
  recentActivity: ActivityRow[];
  // Signed up, no card yet; removed automatically after a week.
  awaitingCard: number;
  // More rows than were read: the booking numbers are a floor.
  truncated: boolean;
};

export type ActivityRow = {
  id: string;
  at: string;
  tenant: { name: string; slug: string } | null;
  actorEmail: string | null;
  action: string;
  summary: string;
};

async function subscriptionPrice() {
  try {
    const price = await getStripe().prices.retrieve(subscriptionPriceId());
    if (price.unit_amount === null) return null;
    return {
      monthly: monthlyPence(price.unit_amount, price.recurring?.interval, price.recurring?.interval_count),
      label: priceLabel(price),
    };
  } catch (error) {
    console.error("Couldn't read the subscription price from Stripe", error);
    return null;
  }
}

export async function getPlatformOverview(now = new Date()): Promise<PlatformOverview> {
  const db = createAdminClient();
  const buckets = weekBuckets(now, WEEKS);
  const since = buckets[0].start.toISOString();
  const day30 = now.getTime() - 30 * DAY;
  const day60 = now.getTime() - 60 * DAY;
  const week = new Date(now.getTime() - 7 * DAY).toISOString();

  const [tenants, bookings, leads, domains, emails, hooks, calendars, requests, activity, price] = await Promise.all([
    db
      .from("tenants")
      .select("id, name, slug, created_at, subscription_status, trial_ends_at, stripe_ready, stripe_account_id, deletion_requested_at")
      .order("created_at", { ascending: false }),
    allRows<{ created_at: string; price_pence: number }>((from, to) =>
      db
        .from("bookings")
        .select("created_at, price_pence")
        .in("status", ["confirmed", "completed"])
        .gte("created_at", new Date(Math.min(day60, Date.parse(since))).toISOString())
        .order("created_at")
        .range(from, to),
    ),
    allRows<{ created_at: string }>((from, to) =>
      db
        .from("leads")
        .select("created_at")
        .gte("created_at", new Date(Math.min(day60, Date.parse(since))).toISOString())
        .order("created_at")
        .range(from, to),
    ),
    db.from("domains").select("tenant_id, hostname, verified"),
    db.from("email_log").select("tenant_id").in("status", ["failed", "bounced"]).gte("created_at", week).limit(5000),
    db.from("webhook_endpoints").select("tenant_id, url, consecutive_failures").eq("active", true).gte("consecutive_failures", 3),
    db.from("calendar_connections").select("tenant_id").eq("status", "needs_reconnect"),
    db
      .from("data_requests")
      .select("tenant_id, kind, due_at")
      .in("status", ["open", "in_progress"])
      .lt("due_at", now.toISOString()),
    db.from("activity_log").select("id, tenant_id, actor_email, action, summary, created_at").order("created_at", { ascending: false }).limit(12),
    subscriptionPrice(),
  ]);
  check(tenants, domains, emails, hooks, calendars, requests, activity);

  const byId = new Map<string, { name: string; slug: string }>(tenants.data!.map((t) => [t.id, { name: t.name, slug: t.slug }]));
  const attention: AttentionItem[] = [];
  const flag = (tenantId: string, item: Omit<AttentionItem, "tenant">) => {
    const tenant = byId.get(tenantId);
    if (tenant) attention.push({ ...item, tenant });
  };

  const plans: Record<PlanGroup, number> = { paying: 0, trial: 0, problem: 0, signup: 0, ended: 0, manual: 0, paused: 0 };
  for (const t of tenants.data!) {
    const group = planGroup(t.subscription_status);
    plans[group]++;

    if (group === "problem") {
      flag(t.id, { kind: "payment_failed", urgent: true, detail: t.subscription_status === "past_due" ? "Card payment failed; Stripe is retrying" : `Subscription ${t.subscription_status}` });
    }
    if (t.subscription_status === "trialing" && trialEndsSoon(t.trial_ends_at, now)) {
      flag(t.id, { kind: "trial_ending", urgent: false, detail: `Trial ends ${formatShortDate(t.trial_ends_at)}` });
    }
    if (t.deletion_requested_at) {
      const due = closureDate(t.deletion_requested_at);
      const overdue = now >= due;
      flag(t.id, {
        kind: overdue ? "closure_due" : "closure_requested",
        urgent: overdue,
        detail: overdue ? `Asked to close; due for deletion since ${formatShortDate(due)}` : `Asked to close; delete on ${formatShortDate(due)}`,
      });
    }
    if (t.stripe_account_id && !t.stripe_ready && group !== "ended") {
      flag(t.id, { kind: "stripe_unfinished", urgent: false, detail: "Started connecting Stripe but didn't finish" });
    }
  }

  for (const d of domains.data!) {
    if (!d.verified && isCustomHostname(d.hostname)) flag(d.tenant_id, { kind: "domain_unverified", urgent: false, detail: `${d.hostname} not verified yet` });
  }

  const failedEmails = new Map<string, number>();
  for (const e of emails.data!) failedEmails.set(e.tenant_id, (failedEmails.get(e.tenant_id) ?? 0) + 1);
  for (const [tenantId, n] of failedEmails) {
    flag(tenantId, { kind: "email_failures", urgent: n >= 5, detail: `${n} ${n === 1 ? "email" : "emails"} failed or bounced this week` });
  }

  for (const h of hooks.data!) {
    flag(h.tenant_id, { kind: "webhook_failing", urgent: false, detail: `Webhook to ${new URL(h.url).host} failed ${h.consecutive_failures} times in a row` });
  }
  for (const c of calendars.data!) {
    flag(c.tenant_id, { kind: "calendar_reconnect", urgent: false, detail: "Google Calendar needs reconnecting; jobs aren't syncing" });
  }
  for (const r of requests.data!) {
    flag(r.tenant_id, { kind: "data_request_overdue", urgent: true, detail: `A customer's ${r.kind} request was due ${formatShortDate(r.due_at)}` });
  }

  const inWindow = (t: string, from: number, to: number) => {
    const at = Date.parse(t);
    return at >= from && at < to;
  };
  const pair = <T>(rows: T[], at: (r: T) => string, value: (r: T) => number = () => 1): Pair => ({
    current: rows.reduce((n, r) => n + (inWindow(at(r), day30, Infinity) ? value(r) : 0), 0),
    previous: rows.reduce((n, r) => n + (inWindow(at(r), day60, day30) ? value(r) : 0), 0),
  });

  const signupCounts = countByWeek(buckets, tenants.data!.map((t) => t.created_at));
  const bookingCounts = countByWeek(buckets, bookings.rows.map((b) => b.created_at));

  return {
    total: tenants.data!.length,
    plans,
    mrr: price ? { pence: price.monthly * plans.paying, paying: plans.paying, priceLabel: price.label } : null,
    signups: pair(tenants.data!, (t) => t.created_at),
    bookings: pair(bookings.rows, (b) => b.created_at),
    bookingValuePence: pair(bookings.rows, (b) => b.created_at, (b) => b.price_pence),
    leads: pair(leads.rows, (l) => l.created_at),
    weeks: buckets.map((b, i) => ({ label: b.label, fullLabel: b.fullLabel, signups: signupCounts[i], bookings: bookingCounts[i] })),
    attention: sortAttention(attention),
    recentSignups: tenants.data!.slice(0, 6).map((t) => ({ name: t.name, slug: t.slug, createdAt: t.created_at, status: t.subscription_status })),
    recentActivity: activity.data!.map((a) => ({
      id: a.id,
      at: a.created_at,
      tenant: byId.get(a.tenant_id) ?? null,
      actorEmail: a.actor_email,
      action: a.action,
      summary: a.summary,
    })),
    awaitingCard: plans.signup,
    truncated: bookings.truncated || leads.truncated,
  };
}
