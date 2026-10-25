import "server-only";
import { securedStatus } from "../booking/engine";
import { notifyBookingSecured } from "../email/notify";
import { createAdminClient } from "../supabase/admin";
import { raiseAlert } from "./alerts";
import { getStripe } from "./client";

// What Stripe payment events do to bookings (info/stripe.md, sections 4 to 6).
// Every function takes the connected account the event came from and resolves
// the tenant from it, so an event can only ever touch its own tenant's rows.

export async function tenantIdForAccount(accountId: string | undefined | null) {
  if (!accountId) return null;
  const { data, error } = await createAdminClient()
    .from("tenants")
    .select("id")
    .eq("stripe_account_id", accountId)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

// The Checkout Session expired or its payment failed: give the slot back.
export async function releaseHold(tenantId: string, bookingId: string) {
  const { error } = await createAdminClient()
    .from("bookings")
    .update({ status: "expired" })
    .eq("tenant_id", tenantId)
    .eq("id", bookingId)
    .eq("status", "held");
  if (error) throw error;
}

export type PaidSession = {
  accountId: string;
  bookingId: string;
  sessionId: string;
  paymentIntentId: string;
  amountPaid: number;
};

// The deposit is paid. Confirms the booking, or, if the hold lapsed and
// someone else took the slot, refunds the deposit in full.
export async function confirmPaidBooking(paid: PaidSession): Promise<"confirmed" | "already_confirmed" | "refunded" | "ignored"> {
  const tenantId = await tenantIdForAccount(paid.accountId);
  const db = createAdminClient();

  const found = tenantId
    ? await db
        .from("bookings")
        .select("id, status, deposit_pence, platform_fee_pence, lead_id")
        .eq("tenant_id", tenantId)
        .eq("id", paid.bookingId)
        .maybeSingle()
    : null;
  if (found?.error) throw found.error;
  const booking = found?.data;
  if (!tenantId || !booking) {
    await raiseAlert({
      kind: "payment_problem",
      tenantId,
      bookingId: paid.bookingId,
      detail: `Paid session ${paid.sessionId} on ${paid.accountId} matches no booking`,
    });
    return "ignored";
  }
  if (paid.amountPaid < booking.deposit_pence) {
    await raiseAlert({
      kind: "payment_problem",
      tenantId,
      bookingId: booking.id,
      detail: `Paid ${paid.amountPaid}p but the deposit is ${booking.deposit_pence}p`,
    });
    return "ignored";
  }

  const paidFields = {
    deposit_status: "paid",
    stripe_payment_intent_id: paid.paymentIntentId,
    stripe_checkout_session_id: paid.sessionId,
  };

  // Both checkout.session.completed and async_payment_succeeded can arrive.
  if (booking.status === "confirmed" || booking.status === "requested") {
    const { error } = await db.from("bookings").update(paidFields).eq("tenant_id", tenantId).eq("id", booking.id);
    if (error) throw error;
    return "already_confirmed";
  }

  // Held, or expired while the customer was paying: take the slot if it's
  // still free. The no-overlap constraint rejects this if it isn't. A
  // business that approves each booking gets it as a request.
  const status = await securedStatus(db, tenantId);
  const { data, error } = await db
    .from("bookings")
    .update({ ...paidFields, status, hold_expires_at: null })
    .eq("tenant_id", tenantId)
    .eq("id", booking.id)
    .in("status", ["held", "expired"])
    .select("id")
    .maybeSingle();
  // 23P01: bookings_no_overlap.
  if (error && error.code !== "23P01") throw error;

  if (data) {
    if (booking.lead_id && status === "confirmed") {
      const lead = await db.from("leads").update({ status: "booked" }).eq("tenant_id", tenantId).eq("id", booking.lead_id);
      if (lead.error) throw lead.error;
    }
    await notifyBookingSecured(tenantId, booking.id);
    return "confirmed";
  }

  // The slot is gone (or the booking was cancelled): return the money.
  await getStripe().refunds.create(
    {
      payment_intent: paid.paymentIntentId,
      ...(booking.platform_fee_pence ? { refund_application_fee: true } : {}),
      metadata: { booking_id: booking.id, reason: "slot_no_longer_available" },
    },
    { stripeAccount: paid.accountId, idempotencyKey: `late-refund-${booking.id}` },
  );
  const refunded = await db
    .from("bookings")
    .update({ deposit_status: "refunded", stripe_payment_intent_id: paid.paymentIntentId })
    .eq("tenant_id", tenantId)
    .eq("id", booking.id);
  if (refunded.error) throw refunded.error;
  await raiseAlert({ kind: "late_payment_refunded", tenantId, bookingId: booking.id });
  return "refunded";
}

// charge.refunded and charge.dispute.created: update the deposit on the
// booking that took this payment.
export async function setDepositStatus(
  accountId: string | undefined | null,
  paymentIntentId: string,
  status: "refunded" | "partially_refunded" | "disputed",
) {
  const tenantId = await tenantIdForAccount(accountId);
  if (!tenantId) return null;
  const { data, error } = await createAdminClient()
    .from("bookings")
    .update({ deposit_status: status })
    .eq("tenant_id", tenantId)
    .eq("stripe_payment_intent_id", paymentIntentId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data ? { tenantId, bookingId: data.id } : { tenantId, bookingId: null };
}

// Owner-initiated refund of a paid deposit: in full, or part of it when
// `amountPence` is less than the deposit (the cancellation policy keeps a
// fee). The webhook confirms it, but the status is set here too so the
// dashboard is right straight away.
export async function refundDeposit(tenantId: string, bookingId: string, amountPence?: number) {
  const db = createAdminClient();
  const { data: booking, error } = await db
    .from("bookings")
    .select("id, deposit_pence, deposit_status, stripe_payment_intent_id, platform_fee_pence")
    .eq("tenant_id", tenantId)
    .eq("id", bookingId)
    .maybeSingle();
  if (error) throw error;
  if (!booking) return { ok: false as const, message: "Booking not found." };
  if (booking.deposit_status !== "paid" || !booking.stripe_payment_intent_id) {
    return { ok: false as const, message: "There's no paid deposit to refund on this booking." };
  }
  const partial = amountPence !== undefined && amountPence < booking.deposit_pence;
  if (amountPence !== undefined && (!Number.isInteger(amountPence) || amountPence <= 0 || amountPence > booking.deposit_pence)) {
    return { ok: false as const, message: "Refund between 1p and the deposit paid." };
  }

  const { data: tenant, error: tenantError } = await db
    .from("tenants")
    .select("stripe_account_id")
    .eq("id", tenantId)
    .single();
  if (tenantError) throw tenantError;
  if (!tenant.stripe_account_id) return { ok: false as const, message: "Stripe isn't connected." };

  try {
    await getStripe().refunds.create(
      {
        payment_intent: booking.stripe_payment_intent_id,
        ...(partial && { amount: amountPence }),
        // Otherwise the detailer would lose the platform's fee as well.
        ...(booking.platform_fee_pence ? { refund_application_fee: true } : {}),
        metadata: { booking_id: booking.id, reason: partial ? "owner_partial_refund" : "owner_refund" },
      },
      { stripeAccount: tenant.stripe_account_id, idempotencyKey: `owner-refund-${booking.id}${partial ? `-${amountPence}` : ""}` },
    );
  } catch (err) {
    console.error("Deposit refund failed", err);
    return { ok: false as const, message: "Stripe couldn't refund this payment. Check your Stripe dashboard." };
  }

  const updated = await db
    .from("bookings")
    .update({ deposit_status: partial ? "partially_refunded" : "refunded" })
    .eq("tenant_id", tenantId)
    .eq("id", booking.id);
  if (updated.error) throw updated.error;
  return { ok: true as const };
}
