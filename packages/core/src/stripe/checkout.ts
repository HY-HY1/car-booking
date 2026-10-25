import "server-only";
import { createAdminClient } from "../supabase/admin";
import { getStripe } from "./client";
import { checkoutExpiresAt, MIN_CHARGE_PENCE } from "./rules";

// The deposit Checkout Session (info/stripe.md, section 3): a direct charge on
// the detailer's own Stripe account, so the customer pays the business and
// Stripe's page carries the detailer's branding.

export type DepositCheckoutInput = {
  tenantId: string;
  bookingId: string;
  leadId: string | null;
  stripeAccountId: string;
  // Both come from the stored booking, never from the browser or the model.
  depositPence: number;
  description: string;
  customerEmail: string;
  // The booking's confirmation page, as a full URL (tenantUrl): where Stripe
  // sends the customer back to, paid or not.
  confirmedUrl: string;
  platformFeePence?: number;
};

export async function createDepositCheckout(input: DepositCheckoutInput) {
  if (input.depositPence < MIN_CHARGE_PENCE) throw new Error("Deposit is below Stripe's minimum charge");
  if (input.platformFeePence !== undefined && input.platformFeePence >= input.depositPence) {
    throw new Error("Application fee must be less than the deposit");
  }

  const session = await getStripe().checkout.sessions.create(
    {
      mode: "payment",
      customer_email: input.customerEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "gbp",
            unit_amount: input.depositPence,
            product_data: { name: input.description },
          },
        },
      ],
      payment_intent_data: {
        ...(input.platformFeePence ? { application_fee_amount: input.platformFeePence } : {}),
        metadata: { tenant_id: input.tenantId, booking_id: input.bookingId, kind: "deposit" },
      },
      metadata: {
        tenant_id: input.tenantId,
        booking_id: input.bookingId,
        kind: "deposit",
        ...(input.leadId && { lead_id: input.leadId }),
      },
      expires_at: checkoutExpiresAt(),
      success_url: input.confirmedUrl,
      cancel_url: `${input.confirmedUrl}?cancelled=1`,
    },
    {
      // Makes it a direct charge on the detailer's account.
      stripeAccount: input.stripeAccountId,
      // A retry for the same booking gets the same session back.
      idempotencyKey: `checkout-${input.bookingId}`,
    },
  );
  if (!session.url) throw new Error("Stripe returned a Checkout Session without a URL");

  const { error } = await createAdminClient()
    .from("bookings")
    .update({
      stripe_checkout_session_id: session.id,
      platform_fee_pence: input.platformFeePence ?? null,
    })
    .eq("tenant_id", input.tenantId)
    .eq("id", input.bookingId);
  if (error) throw error;

  return session.url;
}

export function depositDescription(serviceName: string, startsAt: Date, timezone: string) {
  const when = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(startsAt);
  return `Deposit: ${serviceName}, ${when}`;
}

// The customer came back from Stripe without paying. If their Checkout Session
// is still open, this is the link to carry on with it.
export async function getOpenCheckoutUrl(tenantId: string, bookingId: string) {
  const { data, error } = await createAdminClient()
    .from("bookings")
    .select("status, stripe_checkout_session_id, tenant:tenants(stripe_account_id)")
    .eq("tenant_id", tenantId)
    .eq("id", bookingId)
    .maybeSingle();
  if (error) throw error;
  const accountId = (data?.tenant as unknown as { stripe_account_id: string | null } | null)?.stripe_account_id;
  if (data?.status !== "held" || !data.stripe_checkout_session_id || !accountId) return null;

  const session = await getStripe().checkout.sessions.retrieve(
    data.stripe_checkout_session_id,
    {},
    { stripeAccount: accountId },
  );
  return session.status === "open" ? session.url : null;
}
