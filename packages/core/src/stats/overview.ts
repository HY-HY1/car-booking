import "server-only";
import { createAdminClient } from "../supabase/admin";
import { getTenantPayments } from "../stripe/accounts";
import { getStripe } from "../stripe/client";
import type { ChargeLike, PaymentRow, PaymentSource } from "../stripe/payment-rules";
import { summariseIncome, type IncomeTotals } from "./income";
import { bucketIndex, periodRange, type Period } from "./periods";

// The numbers on the overview page. Bookings, leads and customers come from
// our database; income comes from the business's own Stripe account, so it
// includes payments that never went through a booking. Everything is placed
// in periods in the business's own time zone.

export type Metric = { value: number; previous: number };

export type IncomeState =
  | { state: "hidden" } // not for this person (staff)
  | { state: "not_connected" }
  | { state: "error" }
  | {
      state: "ok";
      current: IncomeTotals;
      previous: IncomeTotals;
      bySource: Record<PaymentSource, number>;
      recent: PaymentRow[];
      // More payments than we read: the totals are a floor.
      truncated: boolean;
    };

export type Overview = {
  period: Period;
  offset: number;
  label: string;
  compareLabel: string;
  previousLabel: string;
  inProgress: boolean;
  timezone: string;
  buckets: { label: string; fullLabel: string; jobs: number; incomePence: number | null }[];
  // Jobs booked for the period (including later in it), and what they're worth.
  jobs: Metric;
  bookedValue: Metric;
  // Activity within the period so far.
  newBookings: Metric;
  leads: Metric;
  customers: Metric;
  // Share of this period's new leads that went on to book.
  conversion: { value: number | null; previous: number | null };
  topServices: { name: string; jobs: number; valuePence: number }[];
  upcoming: { id: string; startsAt: string; customer: string | null; service: string | null }[];
  income: IncomeState;
};

// Supabase returns at most 1,000 rows per request, so a year of bookings has
// to be read in pages or the totals would quietly be short.
async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

// Stripe is the slow part, and toggling between periods re-reads the same
// charges, so they're remembered briefly.
const cache = new Map<string, { at: number; value: Promise<{ charges: ChargeLike[]; truncated: boolean }> }>();
const CACHE_MS = 30_000;
const MAX_CHARGES = 2000;

function chargesBetween(accountId: string, from: Date, to: Date) {
  const key = `${accountId}:${from.getTime()}:${to.getTime()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  const value = (async () => {
    const charges: ChargeLike[] = [];
    let truncated = false;
    const list = getStripe().charges.list(
      {
        created: { gte: Math.floor(from.getTime() / 1000), lt: Math.ceil(to.getTime() / 1000) },
        limit: 100,
        expand: ["data.balance_transaction"],
      },
      { stripeAccount: accountId },
    );
    for await (const c of list) {
      if (charges.length >= MAX_CHARGES) {
        truncated = true;
        break;
      }
      charges.push(c as unknown as ChargeLike);
    }
    return { charges, truncated };
  })();
  cache.set(key, { at: Date.now(), value });
  // A failed read must not be remembered.
  value.catch(() => cache.delete(key));
  return value;
}

const count = <T,>(rows: T[], at: (r: T) => string, from: Date, to: Date) =>
  rows.filter((r) => {
    const t = new Date(at(r)).getTime();
    return t >= from.getTime() && t < to.getTime();
  }).length;

export async function getOverview(
  tenantId: string,
  period: Period,
  offset: number,
  options: { includeIncome: boolean },
): Promise<Overview> {
  const db = createAdminClient();
  const now = new Date();

  const settings = await db.from("booking_settings").select("timezone").eq("tenant_id", tenantId).maybeSingle();
  if (settings.error) throw settings.error;
  const timezone = settings.data?.timezone ?? "Europe/London";
  const range = periodRange(period, offset, now, timezone);

  const from = range.compareStart.toISOString();
  const to = range.end.toISOString();
  const LIVE = ["confirmed", "completed"];

  const [scheduled, made, leads, customers, upcoming, payments] = await Promise.all([
    readAll<{ starts_at: string; price_pence: number; service: { name: string } | null }>((a, b) =>
      db
        .from("bookings")
        .select("starts_at, price_pence, service:services(name)")
        .eq("tenant_id", tenantId)
        .in("status", LIVE)
        .gte("starts_at", from)
        .lt("starts_at", to)
        .order("starts_at")
        .order("id")
        .range(a, b) as unknown as PromiseLike<{ data: never[] | null; error: unknown }>,
    ),
    readAll<{ created_at: string }>((a, b) =>
      db
        .from("bookings")
        .select("created_at")
        .eq("tenant_id", tenantId)
        .in("status", [...LIVE, "no_show"])
        .gte("created_at", from)
        .lt("created_at", to)
        .order("created_at")
        .order("id")
        .range(a, b),
    ),
    readAll<{ created_at: string; status: string }>((a, b) =>
      db
        .from("leads")
        .select("created_at, status")
        .eq("tenant_id", tenantId)
        .gte("created_at", from)
        .lt("created_at", to)
        .order("created_at")
        .order("id")
        .range(a, b),
    ),
    readAll<{ created_at: string }>((a, b) =>
      db
        .from("customers")
        .select("created_at")
        .eq("tenant_id", tenantId)
        .gte("created_at", from)
        .lt("created_at", to)
        .order("created_at")
        .order("id")
        .range(a, b),
    ),
    db
      .from("bookings")
      .select("id, starts_at, customer:customers(name), service:services(name)")
      .eq("tenant_id", tenantId)
      .eq("status", "confirmed")
      .gte("starts_at", now.toISOString())
      .order("starts_at")
      .limit(5),
    options.includeIncome ? getTenantPayments(tenantId) : null,
  ]);
  if (upcoming.error) throw upcoming.error;

  // Jobs: the whole period, against the whole of the one before.
  const jobsNow = scheduled.filter((r) => new Date(r.starts_at) >= range.start);
  const jobsBefore = scheduled.filter((r) => new Date(r.starts_at) < range.previousEnd);
  const sum = (rows: { price_pence: number }[]) => rows.reduce((t, r) => t + r.price_pence, 0);

  const jobsPerBucket = range.buckets.map(() => 0);
  for (const r of jobsNow) {
    const i = bucketIndex(range.buckets, new Date(r.starts_at));
    if (i >= 0) jobsPerBucket[i] += 1;
  }

  const byService = new Map<string, { jobs: number; valuePence: number }>();
  for (const r of jobsNow) {
    const name = r.service?.name ?? "Other";
    const s = byService.get(name) ?? { jobs: 0, valuePence: 0 };
    s.jobs += 1;
    s.valuePence += r.price_pence;
    byService.set(name, s);
  }

  // Activity so far: this period against the same stretch of the last.
  const within = <T extends { created_at: string }>(rows: T[], a: Date, b: Date) =>
    rows.filter((r) => {
      const t = new Date(r.created_at).getTime();
      return t >= a.getTime() && t < b.getTime();
    });
  const leadsNow = within(leads, range.start, range.end);
  const leadsBefore = within(leads, range.compareStart, range.compareEnd);
  const rate = (rows: { status: string }[]) =>
    rows.length ? Math.round((rows.filter((l) => l.status === "booked").length / rows.length) * 100) : null;

  // Income, from Stripe.
  let income: IncomeState = { state: "hidden" };
  let incomePerBucket: number[] | null = null;
  if (payments) {
    if (!payments.accountId) {
      income = { state: "not_connected" };
    } else {
      try {
        const { charges, truncated } = await chargesBetween(payments.accountId, range.compareStart, range.end);
        const s = summariseIncome(charges, range);
        incomePerBucket = s.perBucket;
        income = { state: "ok", current: s.current, previous: s.previous, bySource: s.bySource, recent: s.recent, truncated };
      } catch (error) {
        console.error("Couldn't read income from Stripe", error);
        income = { state: "error" };
      }
    }
  }

  return {
    period,
    offset,
    label: range.label,
    compareLabel: range.compareLabel,
    previousLabel: range.previousLabel,
    inProgress: range.inProgress,
    timezone,
    buckets: range.buckets.map((b, i) => ({
      label: b.label,
      fullLabel: b.fullLabel,
      jobs: jobsPerBucket[i],
      incomePence: incomePerBucket ? incomePerBucket[i] : null,
    })),
    jobs: { value: jobsNow.length, previous: jobsBefore.length },
    bookedValue: { value: sum(jobsNow), previous: sum(jobsBefore) },
    newBookings: {
      value: count(made, (r) => r.created_at, range.start, range.end),
      previous: count(made, (r) => r.created_at, range.compareStart, range.compareEnd),
    },
    leads: { value: leadsNow.length, previous: leadsBefore.length },
    customers: {
      value: count(customers, (r) => r.created_at, range.start, range.end),
      previous: count(customers, (r) => r.created_at, range.compareStart, range.compareEnd),
    },
    conversion: { value: rate(leadsNow), previous: rate(leadsBefore) },
    topServices: [...byService.entries()]
      .map(([name, s]) => ({ name, ...s }))
      .sort((a, b) => b.valuePence - a.valuePence)
      .slice(0, 5),
    upcoming: upcoming.data.map((b) => ({
      id: b.id,
      startsAt: b.starts_at,
      customer: (b.customer as unknown as { name: string } | null)?.name ?? null,
      service: (b.service as unknown as { name: string } | null)?.name ?? null,
    })),
    income,
  };
}
