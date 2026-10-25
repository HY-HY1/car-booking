import "server-only";
import { createElementsCheckout, createHostedCheckout, createPortalUrl, getBillingState } from "@leadgen/core/billing/subscriptions";
import { appUrl, routingConfig } from "@/lib/urls";

// Signup and the billing page share these.

// What signup depends on, and what's missing. Checked before anything is
// created, so a half-configured install turns people away instead of leaving
// accounts that can't get through to paying.
export function signupMissing() {
  const missing: string[] = [];
  // Stripe sends people back to absolute URLs (urls.ts), which in production
  // can't fall back to localhost.
  if (process.env.NODE_ENV === "production") {
    if (!process.env.NEXT_PUBLIC_SITE_URL) missing.push("NEXT_PUBLIC_SITE_URL");
    if (routingConfig().mode === "subdomain" && !process.env.NEXT_PUBLIC_ROOT_DOMAIN) missing.push("NEXT_PUBLIC_ROOT_DOMAIN");
  }
  for (const name of ["STRIPE_SECRET_KEY", "STRIPE_SUBSCRIPTION_PRICE_ID", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"]) {
    if (!process.env[name]) missing.push(name);
  }
  return missing;
}

function returnUrls(tenant: { slug: string }) {
  const slug = encodeURIComponent(tenant.slug);
  return {
    // Stripe fills in {CHECKOUT_SESSION_ID} itself, so it can't be encoded.
    returnUrl: appUrl(`/signup/complete?tenant=${slug}&session_id={CHECKOUT_SESSION_ID}`, { absolute: true }),
    cancelUrl: appUrl(`/signup/billing?tenant=${slug}&cancelled=1`, { absolute: true }),
  };
}

// The card form for the signup's last stage. The caller has already checked
// that this user owns the tenant.
export async function elementsCheckout(tenant: { id: string; slug: string }, email: string | null) {
  return createElementsCheckout({
    tenantId: tenant.id,
    email,
    state: await getBillingState(tenant.id),
    returnUrl: returnUrls(tenant).returnUrl,
  });
}

// Stripe's own payment page, where the recovery page sends people.
export async function hostedCheckoutUrl(tenant: { id: string; slug: string }, email: string | null) {
  return createHostedCheckout({
    tenantId: tenant.id,
    email,
    state: await getBillingState(tenant.id),
    ...returnUrls(tenant),
  });
}

// Settings → Subscription: Stripe's billing portal for a business that has
// already been through Checkout.
export async function billingPortalUrl(tenant: { id: string; slug: string }) {
  const { customerId } = await getBillingState(tenant.id);
  if (!customerId) throw new Error("This business has no Stripe customer yet.");
  return createPortalUrl(customerId, appUrl(`/${encodeURIComponent(tenant.slug)}/settings/billing`, { absolute: true }));
}
