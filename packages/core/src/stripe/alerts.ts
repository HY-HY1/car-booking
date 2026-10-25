import "server-only";
import { notifyStripeAlert } from "../email/notify";

// Things the owner or customer needs to hear about when Stripe tells us
// something. Logged, then emailed (email/notify.ts); sending never throws, so
// a failed email can't fail the webhook.

export type StripeAlert =
  | { kind: "late_payment_refunded"; tenantId: string; bookingId: string }
  | { kind: "dispute_opened"; tenantId: string; bookingId: string | null; disputeId: string; amountPence: number }
  | { kind: "payment_problem"; tenantId: string | null; bookingId: string | null; detail: string };

export async function raiseAlert(alert: StripeAlert) {
  console.error("[stripe alert]", JSON.stringify(alert));
  await notifyStripeAlert(alert);
}
