import "server-only";
import { bookingChanged } from "./changed";
import {
  depositStatusAfterOffline,
  OFFLINE_METHODS,
  takesOfflinePayment,
  type OfflinePayment,
  type PaymentRow,
} from "../stripe/payment-rules";
import { createAdminClient } from "../supabase/admin";

// Money the business took outside Stripe (cash, or a bank transfer), recorded
// by hand from the booking's page. It goes in the payments ledger beside card
// payments, so the booking's "paid" and "to pay" and the overview's income
// count it. Called by the dashboard after its permission check, so it writes
// with the secret key.

type Result = { ok: true } | { ok: false; message: string };
type Booking = { id: string; status: string; deposit_pence: number; deposit_status: string; stripe_payment_intent_id: string | null };

async function loadBooking(tenantId: string, bookingId: string): Promise<Booking | null> {
  const { data, error } = await createAdminClient()
    .from("bookings")
    .select("id, status, deposit_pence, deposit_status, stripe_payment_intent_id")
    .eq("tenant_id", tenantId)
    .eq("id", bookingId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Money taken outside Stripe that covers a deposit not paid online marks it
// paid (and taking it off marks it owed again), so the booking stops asking.
async function settleDeposit(tenantId: string, booking: Booking) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("booking_payments")
    .select("amount_pence")
    .eq("tenant_id", tenantId)
    .eq("booking_id", booking.id)
    .in("kind", [...OFFLINE_METHODS]);
  if (error) throw error;
  const offline = data.reduce((sum, r) => sum + r.amount_pence, 0);
  const next = depositStatusAfterOffline(booking, offline);
  if (next !== booking.deposit_status) {
    const update = await db
      .from("bookings")
      .update({ deposit_status: next })
      .eq("tenant_id", tenantId)
      .eq("id", booking.id)
      .eq("deposit_status", booking.deposit_status);
    if (update.error) throw update.error;
  }
  // The calendar event shows what's paid.
  await bookingChanged(tenantId, booking.id);
}

export async function recordOfflinePayment(
  tenantId: string,
  bookingId: string,
  payment: OfflinePayment,
  recordedBy: string,
): Promise<Result> {
  const booking = await loadBooking(tenantId, bookingId);
  if (!booking) return { ok: false, message: "That booking wasn't found." };
  if (!takesOfflinePayment(booking.status)) return { ok: false, message: "This booking isn't confirmed, so there's nothing to pay yet." };

  const { error } = await createAdminClient()
    .from("booking_payments")
    .insert({
      stripe_charge_id: `manual_${crypto.randomUUID()}`,
      tenant_id: tenantId,
      booking_id: booking.id,
      kind: payment.method,
      amount_pence: payment.amountPence,
      paid_at: new Date().toISOString(),
      recorded_by: recordedBy,
      note: payment.note,
    });
  if (error) throw error;
  await settleDeposit(tenantId, booking);
  return { ok: true };
}

// For one added by mistake. Only payments recorded by hand can be taken off
// this way; card payments are refunded through Stripe.
export async function removeOfflinePayment(tenantId: string, bookingId: string, paymentId: string): Promise<Result> {
  if (!paymentId.startsWith("manual_")) {
    return { ok: false, message: "Only cash and bank transfers can be removed. Refund card payments instead." };
  }
  const booking = await loadBooking(tenantId, bookingId);
  if (!booking) return { ok: false, message: "That booking wasn't found." };

  const { data, error } = await createAdminClient()
    .from("booking_payments")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("booking_id", booking.id)
    .in("kind", [...OFFLINE_METHODS])
    .eq("stripe_charge_id", paymentId)
    .select("stripe_charge_id");
  if (error) throw error;
  if (!data.length) return { ok: false, message: "That payment has already been removed." };
  await settleDeposit(tenantId, booking);
  return { ok: true };
}

// Cash and bank transfers in a stretch of time, as payment rows for the
// overview's income.
export async function offlinePaymentsBetween(tenantId: string, from: Date, to: Date): Promise<PaymentRow[]> {
  const { data, error } = await createAdminClient()
    .from("booking_payments")
    .select("stripe_charge_id, booking_id, kind, amount_pence, paid_at, note")
    .eq("tenant_id", tenantId)
    .in("kind", [...OFFLINE_METHODS])
    .gte("paid_at", from.toISOString())
    .lt("paid_at", to.toISOString())
    .limit(5000);
  if (error) throw error;
  return data.map((r) => ({
    id: r.stripe_charge_id,
    createdAt: r.paid_at,
    amountPence: r.amount_pence,
    refundedPence: 0,
    feePence: 0,
    netPence: r.amount_pence,
    status: "paid",
    source: r.kind as (typeof OFFLINE_METHODS)[number],
    description: null,
    customerName: null,
    customerEmail: null,
    receiptUrl: null,
    paymentIntentId: null,
    bookingId: r.booking_id,
    note: r.note,
  }));
}
