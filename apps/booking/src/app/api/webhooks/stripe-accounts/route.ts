import { getStripe } from "@leadgen/core/stripe/client";
import { claimEvent, handleAccountNotification, relatedObjectId, releaseEventClaim } from "@leadgen/core/stripe/events";

// Accounts v2 events (a connected account's requirements or card payments
// status changed). In the Dashboard this is an event destination using thin
// events, with its own signing secret, STRIPE_ACCOUNTS_WEBHOOK_SECRET.
export async function POST(request: Request) {
  const secret = process.env.STRIPE_ACCOUNTS_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) return new Response("Not configured", { status: 400 });

  const body = await request.text();
  let notification;
  try {
    notification = getStripe().parseEventNotification(body, signature, secret);
  } catch {
    return new Response("Bad signature", { status: 400 });
  }

  const claim = { id: notification.id, type: notification.type, account: relatedObjectId(notification) };
  if (!(await claimEvent(claim))) {
    return new Response("ok");
  }
  try {
    await handleAccountNotification(notification);
  } catch (error) {
    console.error(`Stripe event ${notification.id} (${notification.type}) failed`, error);
    await releaseEventClaim(notification.id);
    return new Response("Failed", { status: 500 });
  }
  return new Response("ok");
}
