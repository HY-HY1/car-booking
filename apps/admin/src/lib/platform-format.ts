import { formatShortDate } from "@leadgen/core/dates";
import type { BadgeTone } from "@/components/ui/badge";

// How the platform admin pages write money, plans and times.

export function gbp(pence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: pence % 100 === 0 ? 0 : 2,
  }).format(pence / 100);
}

// What a business pays us. No status means we bill them ourselves.
const PLAN: Record<string, { label: string; tone: BadgeTone }> = {
  awaiting_checkout: { label: "Signed up, no card", tone: "neutral" },
  trialing: { label: "Trial", tone: "info" },
  active: { label: "Paying", tone: "success" },
  past_due: { label: "Payment failed", tone: "danger" },
  canceled: { label: "Cancelled", tone: "neutral" },
  unpaid: { label: "Unpaid", tone: "danger" },
  incomplete: { label: "Incomplete", tone: "warning" },
  incomplete_expired: { label: "Never started", tone: "neutral" },
  paused: { label: "Paused", tone: "warning" },
};

export function plan(status: string | null, trialEndsAt?: string | null): { label: string; tone: BadgeTone } {
  if (status === null) return { label: "Billed by hand", tone: "violet" };
  if (status === "trialing" && trialEndsAt) return { label: `Trial to ${formatShortDate(trialEndsAt)}`, tone: "info" };
  return PLAN[status] ?? { label: status, tone: "neutral" };
}

// "3 days ago", "just now": for how recent something is.
export function ago(iso: string | null, now = Date.now()) {
  if (!iso) return "never";
  const mins = Math.round((now - Date.parse(iso)) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  if (days < 45) return `${days} ${days === 1 ? "day" : "days"} ago`;
  const months = Math.round(days / 30);
  if (months < 18) return `${months} months ago`;
  return `${Math.round(months / 12)} years ago`;
}

// Whether a moment has passed, read at request time.
export function isPast(when: Date) {
  return Date.now() >= when.getTime();
}

export const STATUS_TONE: Record<string, BadgeTone> = {
  held: "neutral",
  pending: "warning",
  confirmed: "info",
  completed: "success",
  cancelled: "neutral",
  declined: "neutral",
  no_show: "danger",
  expired: "neutral",
};
