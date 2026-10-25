import "server-only";
import Stripe from "stripe";

// One Stripe client for the platform account. Created on first use so a
// build, or an app without Stripe configured, doesn't fail on import. The SDK
// pins the API version, which includes Accounts v2.

let client: Stripe | undefined;

export function getStripe() {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY must be set in the root .env.local.");
    client = new Stripe(key, { maxNetworkRetries: 2 });
  }
  return client;
}
