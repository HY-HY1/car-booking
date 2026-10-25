import { z } from "zod";
import { isUkPostcode } from "../booking/geo";
import { normalizePostcode } from "../customer-fields";
import { LOCATIONS, slugify, slugSchema } from "../platform/rules";

// Self-serve signup and the subscription that pays for it, without touching
// the database or Stripe, so it can be tested. The server half is in
// subscriptions.ts and apps/admin's /onboarding.

export const TRIAL_DAYS = 14;

// tenants.subscription_status. Stripe's own statuses, plus one of ours for
// "signed up but hasn't been through Checkout yet". null means the business
// isn't billed through the app (ASCND, or one set up by hand), and is never
// locked out.
export const AWAITING_CHECKOUT = "awaiting_checkout";

// past_due stays in: Stripe is still retrying the card and a failed payment
// shouldn't lock someone out of their diary mid-week.
const ACCESS = new Set(["trialing", "active", "past_due"]);

export function hasAccess(status: string | null | undefined) {
  return status == null || ACCESS.has(status);
}

export const TRADES = ["detailing", "valeting", "both"] as const;

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(100),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  // 72 is where bcrypt, which Supabase uses, stops reading.
  password: z.string().min(8, "Use at least 8 characters.").max(72, "Use 72 characters or fewer."),
  businessName: z.string().trim().min(1, "Enter your business name.").max(100),
  trade: z.enum(TRADES, "Pick one."),
  locations: z.enum(LOCATIONS, "Pick one."),
  postcode: z
    .string()
    .trim()
    .refine(isUkPostcode, "Enter a full UK postcode, like BS1 4DJ.")
    .transform(normalizePostcode),
});
export type Signup = z.output<typeof signupSchema>;

// Dashboard IDs to try for a business name, best first: "shine", "shine-2",
// "shine-3"… Names that slugify to nothing or to a reserved word skip straight
// to a suffixed one, so there's always something valid to try.
export function slugCandidates(businessName: string, count = 6) {
  const base = slugify(businessName) || "business";
  const out: string[] = [];
  if (slugSchema.safeParse(base).success) out.push(base);
  for (let n = 2; out.length < count; n++) {
    const suffix = `-${n}`;
    const candidate = `${base.slice(0, 40 - suffix.length).replace(/-+$/, "")}${suffix}`;
    if (slugSchema.safeParse(candidate).success) out.push(candidate);
  }
  return out;
}

// "£49.00 a month", for telling someone what they'll pay once the trial ends.
export function priceLabel(price: { unit_amount: number | null; currency: string; recurring?: { interval: string } | null }) {
  if (price.unit_amount === null) return "";
  const amount = new Intl.NumberFormat("en-GB", { style: "currency", currency: price.currency.toUpperCase() }).format(
    price.unit_amount / 100,
  );
  const interval = price.recurring?.interval;
  return interval ? `${amount} a ${interval}` : amount;
}

// ---------------------------------------------------------------- Stripe → tenant

// The parts of a Stripe subscription that matter here, so this file doesn't
// need the Stripe types.
export type SubscriptionLike = {
  id: string;
  status: string;
  customer: string | { id: string };
  trial_end: number | null;
};

// The tenants columns to write for a subscription. The trial end is only kept
// while it still matters: a finished trial is just an active subscription.
export function tenantBillingFields(sub: SubscriptionLike) {
  return {
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    stripe_subscription_id: sub.id,
    subscription_status: sub.status,
    trial_ends_at: sub.status === "trialing" && sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
  };
}
