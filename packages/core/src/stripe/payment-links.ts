import "server-only";
import { createAdminClient } from "../supabase/admin";
import { getTenantPayments } from "./accounts";
import { getStripe } from "./client";
import { loadBookingPayments } from "./ledger";
import { PAYABLE_BOOKING_STATUSES, paymentLinkSchema, paymentSummary, type PaymentLinkInput } from "./payment-rules";

// Payment links (Payments → Payment links): a Stripe link on the business's
// own account that takes a payment of any amount. Owners only, which the
// caller checks; the tenant id always comes from the caller's membership.

export { paymentLinkSchema, type PaymentLinkInput };

export type CreatedPaymentLink = { id: string; url: string; description: string; amountPence: number; singleUse: boolean };

export async function createPaymentLink(
  tenantId: string,
  userId: string,
  input: PaymentLinkInput,
): Promise<{ ok: true; link: CreatedPaymentLink } | { ok: false; message: string }> {
  const { accountId, ready } = await getTenantPayments(tenantId);
  if (!accountId || !ready) {
    return { ok: false, message: "Connect Stripe under Settings → Payments before creating payment links." };
  }

  const db = createAdminClient();
  if (input.bookingId) {
    // Only a booking of this business can be attached.
    const { data, error } = await db
      .from("bookings")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("id", input.bookingId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, message: "That booking wasn't found." };
  }

  const metadata = {
    tenant_id: tenantId,
    kind: "payment_link",
    ...(input.bookingId && { booking_id: input.bookingId }),
  };

  let stripeLink;
  try {
    stripeLink = await getStripe().paymentLinks.create(
      {
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "gbp",
              unit_amount: input.amountPence,
              product_data: { name: input.description },
            },
          },
        ],
        metadata,
        // Carried onto the payment, so it shows up in the Payments list.
        payment_intent_data: { metadata },
        ...(input.singleUse && { restrictions: { completed_sessions: { limit: 1 } } }),
      },
      { stripeAccount: accountId },
    );
  } catch (error) {
    console.error("Creating a payment link failed", error);
    return { ok: false, message: "Stripe couldn't create the link. Try again in a moment." };
  }

  const { data, error } = await db
    .from("payment_links")
    .insert({
      tenant_id: tenantId,
      booking_id: input.bookingId ?? null,
      stripe_payment_link_id: stripeLink.id,
      url: stripeLink.url,
      description: input.description,
      amount_pence: input.amountPence,
      single_use: input.singleUse,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) {
    // Don't leave a live link that we have no record of.
    await getStripe()
      .paymentLinks.update(stripeLink.id, { active: false }, { stripeAccount: accountId })
      .catch((e) => console.error("Couldn't switch off an unrecorded payment link", stripeLink.id, e));
    throw error;
  }

  return {
    ok: true,
    link: {
      id: data.id,
      url: stripeLink.url,
      description: input.description,
      amountPence: input.amountPence,
      singleUse: input.singleUse,
    },
  };
}

// Stops the link taking payments. Payments already made are untouched.
export async function deactivatePaymentLink(tenantId: string, id: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("payment_links")
    .select("id, stripe_payment_link_id")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false as const, message: "That link wasn't found." };

  const { accountId } = await getTenantPayments(tenantId);
  if (!accountId) return { ok: false as const, message: "Stripe isn't connected." };

  try {
    await getStripe().paymentLinks.update(data.stripe_payment_link_id, { active: false }, { stripeAccount: accountId });
  } catch (err) {
    console.error("Deactivating a payment link failed", err);
    return { ok: false as const, message: "Stripe couldn't switch the link off. Try again." };
  }
  const updated = await db.from("payment_links").update({ active: false }).eq("tenant_id", tenantId).eq("id", id);
  if (updated.error) throw updated.error;
  return { ok: true as const };
}

// "Create payment" on a booking: a one-off link for exactly what's still
// owed. The amount is worked out here from the booking and what Stripe says
// has been paid; the browser only says which booking.
export async function createBookingBalanceLink(tenantId: string, userId: string, bookingId: string) {
  const { data: booking, error } = await createAdminClient()
    .from("bookings")
    .select("id, status, starts_at, price_pence, deposit_pence, deposit_status, service:services(name)")
    .eq("tenant_id", tenantId)
    .eq("id", bookingId)
    .maybeSingle();
  if (error) throw error;
  if (!booking) return { ok: false as const, message: "That booking wasn't found." };
  if (!(PAYABLE_BOOKING_STATUSES as readonly string[]).includes(booking.status)) {
    return { ok: false as const, message: "Payments can't be taken on a booking in this state." };
  }

  const { balancePence, fullyPaid } = paymentSummary(booking, await loadBookingPayments(tenantId, booking.id));
  if (fullyPaid) return { ok: false as const, message: "This booking is already paid in full." };

  const service = (booking.service as unknown as { name: string } | null)?.name ?? "Booking";
  const when = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" }).format(
    new Date(booking.starts_at),
  );
  return createPaymentLink(tenantId, userId, {
    description: `${booking.deposit_status === "paid" ? "Balance" : "Payment"}: ${service}, ${when}`,
    amountPence: balancePence,
    singleUse: true,
    bookingId: booking.id,
  });
}
