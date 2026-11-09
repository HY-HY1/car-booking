import { formatPence } from "./config";
import { hmac, verifyHmac } from "../signing";
import { formatNotice, type CancellationPolicy, type RefundAdvice } from "../settings/policy";
import { MIN_CHARGE_PENCE } from "../stripe/rules";

// What a customer can do to their own booking from the link in their emails
// (booking/manage.ts does it), and the link itself. No database access, so it
// can be tested.

// ---------------------------------------------------------------- the link

// "<booking id>.<signature>". The signature covers the business too, so a
// link only opens on that business's own booking pages.
export async function signManageToken(secret: string, tenantId: string, bookingId: string) {
  return `${bookingId}.${await hmac(secret, `manage.${tenantId}.${bookingId}`)}`;
}

// The booking id, or null when the link is broken or for another business.
export async function verifyManageToken(secret: string, tenantId: string, token: string): Promise<string | null> {
  const [bookingId, sig, ...rest] = token.split(".");
  if (rest.length || !bookingId || !sig) return null;
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return null;
  return (await verifyHmac(secret, `manage.${tenantId}.${bookingId}`, sig)) ? bookingId : null;
}

// ---------------------------------------------------------------- what's allowed

// Why a change can't be made online:
//   closed     the booking isn't live (cancelled, done, still being paid for)
//   started    it's already started or passed
//   offline    the business hasn't set a policy, or takes changes by phone or email only
//   too_late   past the policy's cut-off
//   limit      moved as many times as the policy allows
export type Blocked = "closed" | "started" | "offline" | "too_late" | "limit";

export type Option = { allowed: true; until: Date } | { allowed: false; why: Blocked };

export type CustomerOptions = { cancel: Option; reschedule: Option };

export function customerOptions(
  policy: CancellationPolicy | null,
  booking: { status: string; startsAt: string | Date; rescheduleCount: number },
  now: Date = new Date(),
): CustomerOptions {
  const start = new Date(booking.startsAt);
  const both = (why: Blocked): CustomerOptions => ({ cancel: { allowed: false, why }, reschedule: { allowed: false, why } });
  if (booking.status !== "confirmed" && booking.status !== "requested") return both("closed");
  if (start.getTime() <= now.getTime()) return both("started");
  if (!policy || !policy.self_service) return both("offline");

  const cutoff = (hours: number): Option => {
    const until = new Date(start.getTime() - hours * 3_600_000);
    return now.getTime() <= until.getTime() ? { allowed: true, until } : { allowed: false, why: "too_late" };
  };
  const reschedule =
    policy.max_reschedules !== undefined && booking.rescheduleCount >= policy.max_reschedules
      ? ({ allowed: false, why: "limit" } as const)
      : cutoff(policy.reschedule_cutoff_hours);
  return { cancel: cutoff(policy.cutoff_hours), reschedule };
}

// One line for the customer on why they can't do it themselves.
export function blockedLine(what: "cancel" | "reschedule", why: Blocked, policy: CancellationPolicy | null) {
  const verb = what === "cancel" ? "cancel" : "change the time";
  switch (why) {
    case "closed":
    case "started":
      return null;
    case "offline":
      return `To ${verb}, get in touch with the business.`;
    case "too_late": {
      const hours = what === "cancel" ? policy?.cutoff_hours : policy?.reschedule_cutoff_hours;
      return `It's too late to ${verb} online${hours !== undefined ? ` (up to ${formatNotice(hours)} the appointment)` : ""}. Get in touch with the business instead.`;
    }
    case "limit":
      return "You've already changed the time as many times as you can online. Get in touch with the business to change it again.";
  }
}

// What the customer is told will happen to their deposit if they cancel now.
// Refunds are made by the business from its dashboard, so it's what the
// policy says they'll get back, not a promise that it's been sent.
export function refundLine(advice: RefundAdvice | null, depositPaidPence: number) {
  if (depositPaidPence <= 0) return null;
  const paid = formatPence(depositPaidPence);
  if (!advice) return `The business will be in touch about your ${paid} deposit.`;
  if (advice.kind === "full") return `Your ${paid} deposit will be refunded in full.`;
  if (advice.kind === "partial") return `${formatPence(advice.refundPence)} of your ${paid} deposit will be refunded.`;
  return `Your ${paid} deposit isn't refundable under the cancellation policy.`;
}

// ---------------------------------------------------------------- the deposit

// A live booking whose deposit hasn't been paid: one the business made or
// confirmed itself, or one booked before it connected Stripe. The customer
// can pay it from their booking page, and the business can email them the
// link. Stripe won't take less than its minimum charge.
export function depositOwed(b: { status: string; depositPence: number; depositStatus: string }) {
  return (b.status === "confirmed" || b.status === "requested") && b.depositStatus === "pending" && b.depositPence >= MIN_CHARGE_PENCE;
}
