// The product's public name and price, as the marketing pages show them. The
// company behind it (legal pages, invoices) is PLATFORM in
// @leadgen/core/privacy/platform. Testimonials and figures are in lib/proof.ts,
// demo videos in lib/demos.ts. No personal email on the public site: the
// contact form sends to CONTACT_EMAIL (contact/actions.ts).

export const PRODUCT_NAME = "Kerbside";

// The one plan. Keep in step with the Stripe price new businesses subscribe
// to (STRIPE_SUBSCRIPTION_PRICE_ID).
export const PRICE = { monthly: "£49", yearlyPounds: 49 * 12, trialDays: 14 };
