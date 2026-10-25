import "server-only";
import type Stripe from "stripe";
import { getStripe } from "../stripe/client";
import { createAdminClient } from "../supabase/admin";
import { hasAccess, priceLabel, tenantBillingFields, TRIAL_DAYS } from "./rules";

// What a business pays us for the product: a subscription on our own Stripe
// account, with a free trial. Separate from stripe/*, which is the business's
// own connected account taking customers' deposits.

const idOf = (value: string | { id: string } | null | undefined) =>
  typeof value === "string" ? value : (value?.id ?? null);

export type BillingState = {
  status: string | null;
  customerId: string | null;
  subscriptionId: string | null;
  trialEndsAt: string | null;
};

export async function getBillingState(tenantId: string): Promise<BillingState> {
  const { data, error } = await createAdminClient()
    .from("tenants")
    .select("subscription_status, stripe_customer_id, stripe_subscription_id, trial_ends_at")
    .eq("id", tenantId)
    .single();
  if (error) throw error;
  return {
    status: data.subscription_status,
    customerId: data.stripe_customer_id,
    subscriptionId: data.stripe_subscription_id,
    trialEndsAt: data.trial_ends_at,
  };
}

export function subscriptionPriceId() {
  const price = process.env.STRIPE_SUBSCRIPTION_PRICE_ID;
  if (!price) throw new Error("STRIPE_SUBSCRIPTION_PRICE_ID must be set in the root .env.local.");
  return price;
}

type CheckoutArgs = {
  tenantId: string;
  email: string | null;
  state: BillingState;
  // Where Stripe sends them once they've paid. Contains {CHECKOUT_SESSION_ID}.
  returnUrl: string;
};

// What both ways of paying share. The card is collected up front and the first
// charge waits until the trial ends; a trial that ends with no card is
// cancelled rather than left running. Someone who has subscribed before (and
// let it lapse) gets no second trial. Both finish at the same return address,
// so the return step and the webhook don't care which was used.
function subscriptionSession({ tenantId, email, state }: CheckoutArgs) {
  return {
    mode: "subscription" as const,
    line_items: [{ price: subscriptionPriceId(), quantity: 1 }],
    // Which payment methods this page offers. A monthly subscription wants card
    // only: wallets and buy-now-pay-later methods aren't suited to being charged
    // again each month, and Link's "save my details" form is clutter here. Stripe
    // now sets this per configuration (Dashboard → Settings → Payment methods)
    // rather than per request; without this, the account's default one is used.
    ...(process.env.STRIPE_SUBSCRIPTION_PAYMENT_METHOD_CONFIG
      ? { payment_method_configuration: process.env.STRIPE_SUBSCRIPTION_PAYMENT_METHOD_CONFIG }
      : {}),
    client_reference_id: tenantId,
    // An existing customer keeps their saved details; a new one is created
    // from the signup email (which Checkout then locks).
    ...(state.customerId ? { customer: state.customerId } : email ? { customer_email: email } : {}),
    subscription_data: {
      metadata: { tenant_id: tenantId },
      ...(state.subscriptionId
        ? {}
        : {
            trial_period_days: TRIAL_DAYS,
            trial_settings: { end_behavior: { missing_payment_method: "cancel" as const } },
          }),
    },
    metadata: { tenant_id: tenantId },
  };
}

// The card form on our own page (Stripe's Payment Element): the browser gets
// the client secret and a label for what they'll pay after the trial.
export async function createElementsCheckout(args: CheckoutArgs) {
  const stripe = getStripe();
  const [session, price] = await Promise.all([
    stripe.checkout.sessions.create({ ...subscriptionSession(args), ui_mode: "elements", return_url: args.returnUrl }),
    stripe.prices.retrieve(subscriptionPriceId()),
  ]);
  if (!session.client_secret) throw new Error("Stripe didn't return a client secret for the card form.");
  return { clientSecret: session.client_secret, priceLabel: priceLabel(price) };
}

// Stripe's own payment page, for the recovery page: returns its address.
export async function createHostedCheckout(args: CheckoutArgs & { cancelUrl: string }) {
  const session = await getStripe().checkout.sessions.create({
    ...subscriptionSession(args),
    success_url: args.returnUrl,
    cancel_url: args.cancelUrl,
  });
  if (!session.url) throw new Error("Stripe didn't return a Checkout address.");
  return session.url;
}

// Copies a subscription's state onto its tenant. The subscription is always
// fetched fresh rather than trusted from the event, so events arriving late or
// out of order can't write an older status over a newer one. Returns the
// status that was saved, or null if no business owns this subscription.
export async function syncSubscription(subscriptionId: string, tenantHint?: string | null) {
  const sub = await getStripe().subscriptions.retrieve(subscriptionId);
  const tenantId = sub.metadata?.tenant_id || tenantHint || null;

  const update = createAdminClient().from("tenants").update(tenantBillingFields(sub)).select("id");
  const { data, error } = tenantId ? await update.eq("id", tenantId) : await update.eq("stripe_subscription_id", sub.id);
  if (error) throw error;
  if (data.length === 0) return null;
  return sub.status;
}

// The page Stripe sends someone back to after paying: confirm with Stripe
// itself, rather than wait for the webhook, that this Checkout belongs to this
// business and went through. True when they can now come in.
export async function confirmCheckout(sessionId: string, tenantId: string) {
  const session = await getStripe().checkout.sessions.retrieve(sessionId);
  const subscriptionId = idOf(session.subscription);
  if (
    session.client_reference_id !== tenantId ||
    session.mode !== "subscription" ||
    session.status !== "complete" ||
    !subscriptionId
  ) {
    return false;
  }
  // No business updated means nothing was recorded, which isn't access.
  const status = await syncSubscription(subscriptionId, tenantId);
  return status !== null && hasAccess(status);
}

// Stripe is the source of truth for who has paid. If our row still says
// "awaiting checkout" (the return page was never reached, or the webhook
// wasn't listening) but the business does have a subscription there, record it
// rather than let them pay twice. Searching is eventually consistent, so a
// subscription made seconds ago can take a little while to appear. Returns the
// status saved, or null if Stripe has none for this business.
export async function reconcileSubscription(tenantId: string) {
  // The id is a uuid from our own database, so it's safe inside the query.
  const found = await getStripe().subscriptions.search({ query: `metadata['tenant_id']:'${tenantId}'`, limit: 10 });
  const best = found.data.filter((s) => hasAccess(s.status)).sort((a, b) => b.created - a.created)[0] ?? found.data[0];
  if (!best) return null;
  return syncSubscription(best.id, tenantId);
}

// Events on our own account about the subscription. In the Dashboard this is a
// webhook endpoint for "your account" events (not connected accounts).
export async function handleBillingEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const subscriptionId = idOf(session.subscription);
      if (session.mode === "subscription" && subscriptionId) await syncSubscription(subscriptionId, session.client_reference_id);
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscription(event.data.object.id);
      return;
  }
}

// ---------------------------------------------------------------- Settings → Subscription

export type SubscriptionDetails = {
  priceLabel: string;
  // When the current period (or the trial) ends: the next charge, or the last
  // day of access if it's set to cancel.
  periodEnd: string | null;
  cancelsAtPeriodEnd: boolean;
};

// What the Subscription tab shows beyond our own tenants row. Fetched from
// Stripe each time so it's never stale.
export async function getSubscriptionDetails(subscriptionId: string): Promise<SubscriptionDetails> {
  const sub = await getStripe().subscriptions.retrieve(subscriptionId);
  const item = sub.items.data[0];
  const end = item?.current_period_end ?? null;
  return {
    priceLabel: item ? priceLabel(item.price) : "",
    periodEnd: end ? new Date(end * 1000).toISOString() : null,
    cancelsAtPeriodEnd: sub.cancel_at_period_end,
  };
}

// Stripe's hosted billing portal: update the card, see invoices, cancel or
// resume. Returns its address.
export async function createPortalUrl(customerId: string, returnUrl: string) {
  const session = await getStripe().billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
  return session.url;
}
