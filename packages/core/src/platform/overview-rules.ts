// The platform admin's overview, without touching the database or Stripe, so
// it can be tested. The queries are in overview.ts.

const DAY = 86_400_000;

// Stripe statuses where the card has failed or never went through.
const PAYMENT_PROBLEM = new Set(["past_due", "unpaid", "incomplete"]);

export type PlanGroup = "paying" | "trial" | "problem" | "signup" | "ended" | "manual" | "paused";

// One business's plan, as the overview counts it. Payment failed (past_due)
// counts as a problem rather than paying, so it's seen.
export function planGroup(status: string | null): PlanGroup {
  if (status === null) return "manual";
  if (status === "active") return "paying";
  if (status === "trialing") return "trial";
  if (PAYMENT_PROBLEM.has(status)) return "problem";
  if (status === "awaiting_checkout") return "signup";
  if (status === "paused") return "paused";
  return "ended";
}

export const PLAN_GROUP_LABELS: Record<PlanGroup, string> = {
  paying: "Paying",
  trial: "On trial",
  problem: "Payment problem",
  signup: "Signed up, no card",
  ended: "Cancelled",
  manual: "Billed by hand",
  paused: "Paused",
};

// A trial that ends within `days`, and hasn't already ended.
export function trialEndsSoon(trialEndsAt: string | null, now: Date, days = 7) {
  if (!trialEndsAt) return false;
  const left = Date.parse(trialEndsAt) - now.getTime();
  return left >= 0 && left <= days * DAY;
}

// Monthly recurring revenue from a price and how many pay it. A yearly price
// counts a twelfth a month; a weekly one 52/12.
export function monthlyPence(unitAmount: number, interval: string | null | undefined, intervalCount = 1) {
  const n = Math.max(1, intervalCount);
  switch (interval) {
    case "year":
      return Math.round(unitAmount / (12 * n));
    case "week":
      return Math.round((unitAmount * 52) / (12 * n));
    case "day":
      return Math.round((unitAmount * 365) / (12 * n));
    default:
      return Math.round(unitAmount / n);
  }
}

export type WeekBucket = { start: Date; label: string; fullLabel: string };

// The last `weeks` weeks, each starting on a Monday (UTC), oldest first, with
// this week last.
export function weekBuckets(now: Date, weeks = 12): WeekBucket[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const sinceMonday = (new Date(today).getUTCDay() + 6) % 7;
  const thisMonday = today - sinceMonday * DAY;
  const short = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return Array.from({ length: weeks }, (_, i) => {
    const start = new Date(thisMonday - (weeks - 1 - i) * 7 * DAY);
    return { start, label: short.format(start), fullLabel: `Week of ${short.format(start)}` };
  });
}

// How many of `times` fall in each bucket. Anything before the first bucket
// is left out.
export function countByWeek(buckets: WeekBucket[], times: string[]) {
  const counts = buckets.map(() => 0);
  for (const t of times) {
    const at = Date.parse(t);
    for (let i = buckets.length - 1; i >= 0; i--) {
      if (at >= buckets[i].start.getTime()) {
        counts[i]++;
        break;
      }
    }
  }
  return counts;
}

// Things the platform admin should look at, worst first.
export type AttentionKind =
  | "payment_failed"
  | "closure_due"
  | "closure_requested"
  | "data_request_overdue"
  | "trial_ending"
  | "calendar_reconnect"
  | "webhook_failing"
  | "email_failures"
  | "stripe_unfinished"
  | "domain_unverified";

export const ATTENTION_ORDER: AttentionKind[] = [
  "payment_failed",
  "closure_due",
  "data_request_overdue",
  "closure_requested",
  "trial_ending",
  "calendar_reconnect",
  "webhook_failing",
  "email_failures",
  "stripe_unfinished",
  "domain_unverified",
];

export type AttentionItem = {
  kind: AttentionKind;
  tenant: { name: string; slug: string };
  detail: string;
  // Red: something is broken or a deadline has passed.
  urgent: boolean;
};

export function sortAttention(items: AttentionItem[]) {
  return [...items].sort(
    (a, b) =>
      Number(b.urgent) - Number(a.urgent) ||
      ATTENTION_ORDER.indexOf(a.kind) - ATTENTION_ORDER.indexOf(b.kind) ||
      a.tenant.name.localeCompare(b.tenant.name),
  );
}
