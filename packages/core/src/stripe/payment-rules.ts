import { z } from "zod";
import { MIN_CHARGE_PENCE } from "./rules";

// The money rules behind the Payments tab, with no Stripe or database access
// so they can be tested.

// A typo guard, not a Stripe limit: £10,000 is far above any detailing job.
export const MAX_LINK_PENCE = 1_000_000;

// "12", "12.5", "£1,200.00" → pence. Null for anything else, including more
// than two decimal places, so a customer is never charged a rounded amount.
export function parsePounds(input: string): number | null {
  const text = input.trim().replace(/^£/, "");
  // A comma only counts as a thousands separator in 1,200 style grouping.
  // Anything else ("12,5") is ambiguous, and guessing would mean charging
  // ten times too much, so it's refused.
  const cleaned = /^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(text) ? text.replace(/,/g, "") : text;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

export const paymentLinkSchema = z.object({
  description: z.string().trim().min(1, "Say what the payment is for.").max(120, "Keep it under 120 characters."),
  amountPence: z
    .string()
    .transform((v, ctx) => {
      const pence = parsePounds(v);
      if (pence === null) {
        ctx.addIssue({ code: "custom", message: "Enter an amount like 45 or 45.50." });
        return z.NEVER;
      }
      return pence;
    })
    .pipe(
      z
        .number()
        .min(MIN_CHARGE_PENCE, "The smallest payment Stripe takes is 30p.")
        .max(MAX_LINK_PENCE, "That's over £10,000. Check the amount."),
    ),
  singleUse: z.boolean().default(true),
  bookingId: z.uuid().optional(),
});
export type PaymentLinkInput = z.output<typeof paymentLinkSchema>;

// What's left to pay on a booking once any deposit actually paid is taken off.
// A refunded deposit doesn't count: the customer owes the full price again.
export function balanceDuePence(booking: { price_pence: number; deposit_pence: number; deposit_status: string }) {
  const paid = booking.deposit_status === "paid" || booking.deposit_status === "disputed" ? booking.deposit_pence : 0;
  return Math.max(0, booking.price_pence - paid);
}

export type PaymentStatus = "paid" | "pending" | "refunded" | "partially_refunded" | "disputed" | "failed";
// Cash and bank transfers are recorded by the business by hand
// (booking/offline-payments.ts); the rest are Stripe charges.
export const OFFLINE_METHODS = ["cash", "bank_transfer"] as const;
export type OfflineMethod = (typeof OFFLINE_METHODS)[number];
export type PaymentSource = "deposit" | "payment_link" | "other" | OfflineMethod;

export function isOffline(source: PaymentSource): source is OfflineMethod {
  return (OFFLINE_METHODS as readonly string[]).includes(source);
}

// The parts of a Stripe Charge the Payments tab reads.
export type ChargeLike = {
  id: string;
  created: number;
  amount: number;
  amount_refunded: number;
  status: string;
  refunded: boolean;
  disputed: boolean;
  description: string | null;
  receipt_url: string | null;
  metadata: Record<string, string>;
  payment_intent: string | { id: string } | null;
  billing_details: { name: string | null; email: string | null };
  balance_transaction: string | { fee: number; net: number } | null;
};

export type PaymentRow = {
  id: string;
  createdAt: string;
  amountPence: number;
  refundedPence: number;
  feePence: number | null;
  netPence: number | null;
  status: PaymentStatus;
  source: PaymentSource;
  description: string | null;
  customerName: string | null;
  customerEmail: string | null;
  receiptUrl: string | null;
  paymentIntentId: string | null;
  bookingId: string | null;
  // What the business wrote against a cash payment or bank transfer.
  note?: string | null;
};

export function paymentStatus(charge: Pick<ChargeLike, "status" | "disputed" | "refunded" | "amount_refunded">): PaymentStatus {
  if (charge.status === "failed") return "failed";
  if (charge.status === "pending") return "pending";
  if (charge.disputed) return "disputed";
  if (charge.refunded) return "refunded";
  return charge.amount_refunded > 0 ? "partially_refunded" : "paid";
}

export function toPaymentRow(charge: ChargeLike): PaymentRow {
  const tx = typeof charge.balance_transaction === "object" ? charge.balance_transaction : null;
  const bookingId = z.uuid().safeParse(charge.metadata.booking_id).data ?? null;
  return {
    id: charge.id,
    createdAt: new Date(charge.created * 1000).toISOString(),
    amountPence: charge.amount,
    refundedPence: charge.amount_refunded,
    feePence: tx?.fee ?? null,
    netPence: tx?.net ?? null,
    status: paymentStatus(charge),
    source: charge.metadata.kind === "payment_link" ? "payment_link" : charge.metadata.kind === "deposit" || bookingId ? "deposit" : "other",
    description: charge.description,
    customerName: charge.billing_details.name,
    customerEmail: charge.billing_details.email,
    receiptUrl: charge.receipt_url,
    paymentIntentId: typeof charge.payment_intent === "string" ? charge.payment_intent : (charge.payment_intent?.id ?? null),
    bookingId,
  };
}

// ---------------------------------------------------------------- outside Stripe

// "Record payment" on a booking: cash, or a bank transfer. Any amount from 1p:
// a tip or a fee on top of the price is still money taken.
export const offlinePaymentSchema = z.object({
  method: z.enum(OFFLINE_METHODS, "Pick how they paid."),
  amountPence: z
    .string()
    .transform((v, ctx) => {
      const pence = parsePounds(v);
      if (pence === null || pence <= 0) {
        ctx.addIssue({ code: "custom", message: "Enter an amount like 45 or 45.50." });
        return z.NEVER;
      }
      return pence;
    })
    .pipe(z.number().max(MAX_LINK_PENCE, "That's over £10,000. Check the amount.")),
  note: z
    .string()
    .trim()
    .max(200, "Keep the note under 200 characters.")
    .default("")
    .transform((v) => v || null),
});
export type OfflinePayment = z.output<typeof offlinePaymentSchema>;

// Bookings a payment can be recorded against: any that's been booked. A hold
// is mid-way through the customer's own checkout, and an expired one never was.
export function takesOfflinePayment(status: string) {
  return status !== "held" && status !== "expired";
}

// What the deposit should say once money taken outside Stripe has been
// recorded or removed. Only a deposit not paid through Stripe is touched:
// payments that cover it mark it paid, and removing them puts it back to
// owed. A Stripe deposit, a refunded or waived one, and a booking with no
// deposit are left as they are.
export function depositStatusAfterOffline(
  booking: { deposit_pence: number; deposit_status: string; stripe_payment_intent_id: string | null },
  offlinePence: number,
): string {
  if (booking.deposit_pence <= 0 || booking.stripe_payment_intent_id) return booking.deposit_status;
  if (booking.deposit_status !== "pending" && booking.deposit_status !== "paid") return booking.deposit_status;
  return offlinePence >= booking.deposit_pence ? "paid" : "pending";
}

// Bookings that can still have money taken against them. A hold is mid-way
// through the customer's own checkout, and cancelled or expired ones are over.
export const PAYABLE_BOOKING_STATUSES = ["confirmed", "completed", "no_show"] as const;

// How much of a booking has actually been paid, and what's left. Stripe's
// payments for the booking (found by the booking id on them) are the truth,
// since a balance paid by link isn't recorded on the booking itself. The
// booking's own deposit status is the floor, for when Stripe's search hasn't
// caught up with a payment from the last minute or so, or can't be reached.
// Refunded money doesn't count as paid.
export function paymentSummary(
  booking: { price_pence: number; deposit_pence: number; deposit_status: string },
  stripePayments: Pick<PaymentRow, "status" | "amountPence" | "refundedPence">[] | null,
) {
  const recordedDeposit = booking.deposit_status === "paid" || booking.deposit_status === "disputed" ? booking.deposit_pence : 0;
  const fromStripe = (stripePayments ?? [])
    .filter((p) => p.status !== "failed")
    .reduce((sum, p) => sum + p.amountPence - p.refundedPence, 0);
  const paidPence = Math.max(recordedDeposit, fromStripe);
  return {
    paidPence,
    balancePence: Math.max(0, booking.price_pence - paidPence),
    fullyPaid: paidPence >= booking.price_pence,
  };
}
