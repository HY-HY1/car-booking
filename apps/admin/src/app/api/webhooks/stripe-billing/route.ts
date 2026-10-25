import { handleBillingEvent } from "@leadgen/core/billing/subscriptions";
import { getStripe } from "@leadgen/core/stripe/client";
import { claimEvent, releaseEventClaim } from "@leadgen/core/stripe/events";

// Stripe events about what businesses pay us: the trial starting, the first
// payment, a card failing, a cancellation. In the Dashboard this is a webhook
// endpoint for events on YOUR account (not "connected accounts", which is the
// booking app's /api/webhooks/stripe); its signing secret is
// STRIPE_BILLING_WEBHOOK_SECRET. Locally: stripe listen --forward-to
// localhost:3000/api/webhooks/stripe-billing (through the dev router)
export async function POST(request: Request) {
  const secret = process.env.STRIPE_BILLING_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) return new Response("Not configured", { status: 400 });

  // The signature covers the raw body, so it's read as text.
  const body = await request.text();
  let event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return new Response("Bad signature", { status: 400 });
  }

  if (!(await claimEvent(event))) return new Response("ok");
  try {
    await handleBillingEvent(event);
  } catch (error) {
    console.error(`Stripe billing event ${event.id} (${event.type}) failed`, error);
    // Let Stripe's retry run it again.
    await releaseEventClaim(event.id);
    return new Response("Failed", { status: 500 });
  }
  return new Response("ok");
}
