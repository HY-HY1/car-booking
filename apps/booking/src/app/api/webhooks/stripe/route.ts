import { getStripe } from "@leadgen/core/stripe/client";
import { claimEvent, handleConnectEvent, releaseEventClaim } from "@leadgen/core/stripe/events";

// Stripe events from detailers' connected accounts: deposits paid, expired,
// refunded and disputed. In the Dashboard this is a webhook endpoint set to
// listen to "events on connected accounts"; its signing secret is
// STRIPE_WEBHOOK_SECRET. Locally: stripe listen --forward-connect-to
// localhost:3000/api/webhooks/stripe (through the dev router)
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
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
    await handleConnectEvent(event);
  } catch (error) {
    console.error(`Stripe event ${event.id} (${event.type}) failed`, error);
    // Let Stripe's retry run it again.
    await releaseEventClaim(event.id);
    return new Response("Failed", { status: 500 });
  }
  return new Response("ok");
}
