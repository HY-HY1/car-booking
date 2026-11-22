import "server-only";
import { createAdminClient } from "../supabase/admin";
import { check } from "./query";

// The platform admin's System page: which settings are filled in, which
// database migrations have been run, and what has been failing. Uses the
// secret key; the caller has checked requirePlatformAdmin().

export type EnvCheck = { name: string; set: boolean; required: boolean; does: string };
export type EnvGroup = { title: string; checks: EnvCheck[] };

const ENV: { title: string; vars: [name: string, required: boolean, does: string][] }[] = [
  {
    title: "Core",
    vars: [
      ["NEXT_PUBLIC_SUPABASE_URL", true, "The database"],
      ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", true, "Signing in"],
      ["SUPABASE_SECRET_KEY", true, "Server access to the database"],
      ["NEXT_PUBLIC_SITE_URL", true, "Every absolute link: emails, Stripe, Supabase"],
      ["ROUTING_MODE", false, "path or subdomain addresses (defaults to path)"],
      ["CRON_SECRET", true, "Scheduled jobs: reminders, emails, retention, calendar sync"],
    ],
  },
  {
    title: "Stripe",
    vars: [
      ["STRIPE_SECRET_KEY", true, "Deposits and subscriptions"],
      ["STRIPE_WEBHOOK_SECRET", true, "Deposit payments reaching bookings"],
      ["STRIPE_ACCOUNTS_WEBHOOK_SECRET", true, "Businesses finishing Stripe setup"],
      ["STRIPE_SUBSCRIPTION_PRICE_ID", true, "What businesses pay you"],
      ["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", true, "The card form at sign-up"],
      ["STRIPE_BILLING_WEBHOOK_SECRET", true, "Subscription changes reaching the app"],
      ["STRIPE_SUBSCRIPTION_PAYMENT_METHOD_CONFIG", false, "Card-only subscription checkout"],
    ],
  },
  {
    title: "Email",
    vars: [
      ["RESEND_API_KEY", true, "Sending every email"],
      ["EMAIL_FROM_ADDRESS", true, "The default sender"],
      ["RESEND_WEBHOOK_SECRET", true, "Bounces and spam complaints"],
      ["PLATFORM_ALERT_EMAIL", false, "Alerts to you"],
      ["CONTACT_EMAIL", false, "The marketing site's contact form"],
    ],
  },
  {
    title: "Secrets",
    vars: [
      ["BOOKING_LINK_SECRET", true, "Customers' “Manage your booking” links"],
      ["PRIVACY_TOKEN_SECRET", true, "One-click unsubscribe links"],
      ["CALENDAR_TOKEN_SECRET", false, "Sealing Google and webhook secrets"],
      ["NEXT_PUBLIC_TURNSTILE_SITE_KEY", false, "Bot check on public forms"],
      ["TURNSTILE_SECRET_KEY", false, "Bot check on public forms"],
    ],
  },
  {
    title: "Google, Meta and AI",
    vars: [
      ["GOOGLE_MAPS_API_KEY", false, "Drive times between jobs"],
      ["GOOGLE_OAUTH_CLIENT_ID", false, "Google Calendar and reviews"],
      ["GOOGLE_OAUTH_CLIENT_SECRET", false, "Google Calendar and reviews"],
      ["META_APP_ID", false, "Facebook and Instagram lead forms"],
      ["META_APP_SECRET", false, "Facebook and Instagram lead forms"],
      ["META_WEBHOOK_VERIFY_TOKEN", false, "Facebook and Instagram lead forms"],
      ["ANTHROPIC_API_KEY", false, "Reading a car's condition from photos"],
    ],
  },
  {
    title: "Hosting and legal",
    vars: [
      ["VERCEL_API_TOKEN", false, "Adding businesses' own domains automatically"],
      ["VERCEL_PROJECT_ID", false, "Adding businesses' own domains automatically"],
      ["NEXT_PUBLIC_LEGAL_NAME", true, "Your company name on the legal pages"],
      ["NEXT_PUBLIC_LEGAL_ADDRESS", true, "Your address on the legal pages"],
      ["NEXT_PUBLIC_COMPANY_NUMBER", false, "Your company number on the legal pages"],
      ["NEXT_PUBLIC_ICO_NUMBER", true, "Your ICO registration on the legal pages"],
      ["NEXT_PUBLIC_PRIVACY_EMAIL", true, "Where privacy questions go"],
    ],
  },
];

export function envChecks(env: Record<string, string | undefined> = process.env): EnvGroup[] {
  return ENV.map((g) => ({
    title: g.title,
    checks: g.vars.map(([name, required, does]) => ({ name, required, does, set: Boolean(env[name]?.trim()) })),
  }));
}

export function stripeMode(key = process.env.STRIPE_SECRET_KEY): "live" | "test" | "none" {
  if (!key) return "none";
  return key.startsWith("sk_live") || key.startsWith("rk_live") ? "live" : "test";
}

// One thing each migration added, to tell whether it has been run. Newest
// first: the ones most likely to be missing.
const MIGRATIONS: { file: string; table: string; column: string }[] = [
  { file: "20261117120000_launch_fixes", table: "customers", column: "email_marketing_requested_at" },
  { file: "20261115120000_multi_car", table: "booking_settings", column: "multi_car" },
  { file: "20261114120000_email_bounces", table: "customers", column: "email_bounced_at" },
  { file: "20261113120000_api_v1", table: "api_keys", column: "scopes" },
  { file: "20261112120000_integrations", table: "webhook_endpoints", column: "id" },
  { file: "20261111120000_bookings_and_growth", table: "booking_vehicles", column: "id" },
  { file: "20261110120000_account_security", table: "activity_log", column: "id" },
  { file: "20261104120000_customer_changes", table: "bookings", column: "reschedule_count" },
  { file: "20261102120000_google_calendar", table: "calendar_connections", column: "id" },
];

export type MigrationCheck = { file: string; applied: boolean };

export async function migrationChecks(): Promise<MigrationCheck[]> {
  const db = createAdminClient();
  return Promise.all(
    MIGRATIONS.map(async (m) => {
      const { error } = await db.from(m.table).select(m.column).limit(1);
      return { file: m.file, applied: !error };
    }),
  );
}

export type Failure = { id: string; at: string; tenant: { name: string; slug: string } | null; what: string; detail: string | null };

const one = <T>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export async function recentFailures(now = new Date()) {
  const db = createAdminClient();
  const week = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const hourAgo = new Date(now.getTime() - 3_600_000).toISOString();

  const [emails, stuck, deliveries, calendars, stripeEvents] = await Promise.all([
    db
      .from("email_log")
      .select("id, kind, status, error, created_at, tenant:tenants(name, slug)")
      .in("status", ["failed", "bounced", "complained"])
      .gte("created_at", week)
      .order("created_at", { ascending: false })
      .limit(25),
    db.from("email_log").select("id", { count: "exact", head: true }).eq("status", "sending").lt("created_at", hourAgo),
    db
      .from("webhook_deliveries")
      .select("id, event_type, response_status, attempts, created_at, tenant:tenants(name, slug)")
      .eq("status", "failed")
      .gte("created_at", week)
      .order("created_at", { ascending: false })
      .limit(25),
    db.from("calendar_connections").select("id, last_error, updated_at, tenant:tenants(name, slug)").eq("status", "needs_reconnect"),
    db.from("stripe_events").select("received_at").order("received_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  check(emails, stuck, deliveries, calendars, stripeEvents);

  return {
    emails: emails.data!.map(
      (e): Failure => ({ id: e.id, at: e.created_at, tenant: one(e.tenant), what: `${e.kind.replaceAll("_", " ")} email ${e.status}`, detail: e.error }),
    ),
    // Claimed but never finished: the send crashed partway.
    stuckEmails: stuck.count ?? 0,
    deliveries: deliveries.data!.map(
      (d): Failure => ({
        id: d.id,
        at: d.created_at,
        tenant: one(d.tenant),
        what: `${d.event_type} webhook`,
        detail: `Gave up after ${d.attempts} ${d.attempts === 1 ? "try" : "tries"}${d.response_status ? `, last answer ${d.response_status}` : ""}`,
      }),
    ),
    calendars: calendars.data!.map(
      (c): Failure => ({ id: c.id, at: c.updated_at, tenant: one(c.tenant), what: "Google Calendar needs reconnecting", detail: c.last_error }),
    ),
    lastStripeEventAt: (stripeEvents.data?.received_at as string | undefined) ?? null,
  };
}
