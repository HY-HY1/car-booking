import "server-only";
import { getSubscriptionDetails, type SubscriptionDetails } from "../billing/subscriptions";
import { createAdminClient } from "../supabase/admin";
import { formatShortDate } from "../dates";
import { check } from "./query";
import type { ActivityRow } from "./overview";

// Everything the platform admin sees about one business beyond its summary:
// its profile, how much it's being used, which integrations are on, how its
// emails are going, and what has changed lately. Customers' names and contact
// details are left out: the platform only needs to know the business is
// working, not who its customers are. Uses the secret key; the caller has
// checked requirePlatformAdmin() and looked the business up by its slug.

const DAY = 86_400_000;

export type Connection = { state: "on" | "off" | "problem"; detail: string };

export type BusinessDetail = {
  profile: {
    trade: string;
    contactEmail: string | null;
    contactPhone: string | null;
    termsAcceptedAt: string | null;
    termsVersion: string | null;
  };
  billing: {
    status: string | null;
    trialEndsAt: string | null;
    customerId: string | null;
    subscriptionId: string | null;
    // From Stripe; null when there's no subscription or Stripe couldn't be reached.
    subscription: SubscriptionDetails | null;
    stripeError: boolean;
  };
  usage: {
    bookings: number;
    upcoming: number;
    booked30: number;
    value30Pence: number;
    cancelled30: number;
    leads: number;
    leads30: number;
    customers: number;
    services: number;
    lastBookingAt: string | null;
    lastLeadAt: string | null;
  };
  connections: {
    stripe: Connection;
    email: Connection;
    calendar: Connection;
    googleReviews: Connection;
    meta: Connection;
    webhooks: Connection;
    apiKeys: Connection;
  };
  emails30: Record<"sent" | "failed" | "bounced" | "complained" | "sending", number>;
  recentBookings: {
    id: string;
    startsAt: string;
    createdAt: string;
    status: string;
    pricePence: number;
    depositStatus: string;
    service: string | null;
    source: string;
  }[];
  activity: ActivityRow[];
};

const one = <T>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export async function getBusinessDetail(tenant: { id: string; name: string; slug: string }, now = new Date()): Promise<BusinessDetail> {
  const db = createAdminClient();
  const id = tenant.id;
  const day30 = new Date(now.getTime() - 30 * DAY).toISOString();
  const live = ["confirmed", "completed"];
  const count = { count: "exact" as const, head: true };

  const [
    row,
    bookings,
    upcoming,
    booked30,
    cancelled30,
    leads,
    leads30,
    customers,
    services,
    lastLead,
    recent,
    sender,
    calendar,
    reviews,
    meta,
    hooks,
    keys,
    emails,
    activity,
  ] = await Promise.all([
    db
      .from("tenants")
      .select(
        "trade, contact_email, contact_phone, terms_accepted_at, terms_version, subscription_status, trial_ends_at, stripe_customer_id, stripe_subscription_id, stripe_account_id, stripe_ready",
      )
      .eq("id", id)
      .single(),
    db.from("bookings").select("id", count).eq("tenant_id", id).in("status", live),
    db.from("bookings").select("id", count).eq("tenant_id", id).eq("status", "confirmed").gte("starts_at", now.toISOString()),
    db.from("bookings").select("price_pence").eq("tenant_id", id).in("status", live).gte("created_at", day30).limit(5000),
    db.from("bookings").select("id", count).eq("tenant_id", id).eq("status", "cancelled").gte("updated_at", day30),
    db.from("leads").select("id", count).eq("tenant_id", id),
    db.from("leads").select("id", count).eq("tenant_id", id).gte("created_at", day30),
    db.from("customers").select("id", count).eq("tenant_id", id),
    db.from("services").select("id", count).eq("tenant_id", id).eq("active", true),
    db.from("leads").select("created_at").eq("tenant_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db
      .from("bookings")
      .select("id, starts_at, created_at, status, price_pence, deposit_status, source, service:services(name)")
      .eq("tenant_id", id)
      .neq("status", "held")
      .order("created_at", { ascending: false })
      .limit(10),
    db.from("email_senders").select("address, status").eq("tenant_id", id).maybeSingle(),
    db.from("calendar_connections").select("account_email, status").eq("tenant_id", id).maybeSingle(),
    db.from("google_business_connections").select("location_title, status, total_reviews, average_rating").eq("tenant_id", id).maybeSingle(),
    db.from("meta_connections").select("page_name, status, last_lead_at").eq("tenant_id", id).maybeSingle(),
    db.from("webhook_endpoints").select("active, consecutive_failures").eq("tenant_id", id),
    db.from("api_keys").select("last_used_at").eq("tenant_id", id).is("revoked_at", null),
    db.from("email_log").select("status").eq("tenant_id", id).gte("created_at", day30).limit(10000),
    db.from("activity_log").select("id, actor_email, action, summary, created_at").eq("tenant_id", id).order("created_at", { ascending: false }).limit(15),
  ]);
  check(row, bookings, upcoming, booked30, cancelled30, leads, leads30, customers, services, lastLead, recent, sender, calendar, reviews, meta, hooks, keys, emails, activity);

  const t = row.data!;
  let subscription: SubscriptionDetails | null = null;
  let stripeError = false;
  if (t.stripe_subscription_id) {
    try {
      subscription = await getSubscriptionDetails(t.stripe_subscription_id);
    } catch (error) {
      console.error("Couldn't read a business's subscription from Stripe", error);
      stripeError = true;
    }
  }

  const emails30 = { sent: 0, failed: 0, bounced: 0, complained: 0, sending: 0 };
  for (const e of emails.data!) if (e.status in emails30) emails30[e.status as keyof typeof emails30]++;

  const activeHooks = hooks.data!.filter((h) => h.active);
  const failingHooks = activeHooks.filter((h) => h.consecutive_failures >= 3);
  const lastKeyUse = keys.data!.map((k) => k.last_used_at).filter(Boolean).sort().at(-1) ?? null;
  const recentRows = recent.data!;

  return {
    profile: {
      trade: t.trade,
      contactEmail: t.contact_email,
      contactPhone: t.contact_phone,
      termsAcceptedAt: t.terms_accepted_at,
      termsVersion: t.terms_version,
    },
    billing: {
      status: t.subscription_status,
      trialEndsAt: t.trial_ends_at,
      customerId: t.stripe_customer_id,
      subscriptionId: t.stripe_subscription_id,
      subscription,
      stripeError,
    },
    usage: {
      bookings: bookings.count ?? 0,
      upcoming: upcoming.count ?? 0,
      booked30: booked30.data!.length,
      value30Pence: booked30.data!.reduce((n, b) => n + b.price_pence, 0),
      cancelled30: cancelled30.count ?? 0,
      leads: leads.count ?? 0,
      leads30: leads30.count ?? 0,
      customers: customers.count ?? 0,
      services: services.count ?? 0,
      lastBookingAt: recentRows[0]?.created_at ?? null,
      lastLeadAt: lastLead.data?.created_at ?? null,
    },
    connections: {
      stripe: t.stripe_ready
        ? { state: "on", detail: "Taking card payments" }
        : t.stripe_account_id
          ? { state: "problem", detail: "Setup started, not finished" }
          : { state: "off", detail: "Not connected" },
      email: !sender.data
        ? { state: "off", detail: "Using the platform's address" }
        : sender.data.status === "verified"
          ? { state: "on", detail: `Sending as ${sender.data.address}` }
          : { state: "problem", detail: `${sender.data.address}: ${sender.data.status === "failed" ? "DNS check failed" : "waiting for DNS"}` },
      calendar: !calendar.data
        ? { state: "off", detail: "Not connected" }
        : calendar.data.status === "active"
          ? { state: "on", detail: calendar.data.account_email ?? "Connected" }
          : { state: "problem", detail: "Needs reconnecting" },
      googleReviews: !reviews.data
        ? { state: "off", detail: "Not connected" }
        : reviews.data.status !== "active"
          ? { state: "problem", detail: "Needs reconnecting" }
          : reviews.data.location_title
            ? {
                state: "on",
                detail: `${reviews.data.location_title}${reviews.data.total_reviews != null ? ` · ${reviews.data.total_reviews} reviews` : ""}${reviews.data.average_rating != null ? `, ${reviews.data.average_rating}★` : ""}`,
              }
            : { state: "problem", detail: "Connected, no location picked" },
      meta: !meta.data
        ? { state: "off", detail: "Not connected" }
        : meta.data.status === "active"
          ? { state: "on", detail: meta.data.page_name ?? "Connected" }
          : { state: "problem", detail: meta.data.status === "choose_page" ? "Connected, no Page picked" : "Needs reconnecting" },
      webhooks: activeHooks.length === 0
        ? { state: "off", detail: "None" }
        : failingHooks.length
          ? { state: "problem", detail: `${failingHooks.length} of ${activeHooks.length} failing` }
          : { state: "on", detail: `${activeHooks.length} active` },
      apiKeys: keys.data!.length === 0
        ? { state: "off", detail: "None" }
        : { state: "on", detail: `${keys.data!.length} active${lastKeyUse ? `, last used ${formatShortDate(lastKeyUse)}` : ", never used"}` },
    },
    emails30,
    recentBookings: recentRows.map((b) => ({
      id: b.id,
      startsAt: b.starts_at,
      createdAt: b.created_at,
      status: b.status,
      pricePence: b.price_pence,
      depositStatus: b.deposit_status,
      service: one(b.service as { name: string } | { name: string }[] | null)?.name ?? null,
      source: b.source,
    })),
    activity: activity.data!.map((a) => ({
      id: a.id,
      at: a.created_at,
      tenant: { name: tenant.name, slug: tenant.slug },
      actorEmail: a.actor_email,
      action: a.action,
      summary: a.summary,
    })),
  };
}
