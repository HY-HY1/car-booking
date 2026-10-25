// Stripe rules that don't need Stripe or the database, kept apart so they can
// be tested. See info/stripe.md.

// Stripe won't create a charge below this (GBP).
export const MIN_CHARGE_PENCE = 30;

// A Checkout Session can't expire sooner than 30 minutes after it's created.
const SESSION_MINUTES = 31;

// A held slot has to outlast the Checkout Session, otherwise a customer could
// pay a session that is still open for a slot already given away.
export const MIN_ONLINE_HOLD_MINUTES = SESSION_MINUTES + 4;

// Whether a deposit is taken through Stripe Checkout. Otherwise the booking is
// confirmed straight away and the owner collects the deposit themselves.
export function collectsDepositOnline(depositPence: number, stripeReady: boolean) {
  return stripeReady && depositPence >= MIN_CHARGE_PENCE;
}

export function holdMinutesFor(configuredMinutes: number, online: boolean) {
  return online ? Math.max(configuredMinutes, MIN_ONLINE_HOLD_MINUTES) : configuredMinutes;
}

// Unix seconds, as Stripe's expires_at wants.
export function checkoutExpiresAt(now = Date.now()) {
  return Math.floor(now / 1000) + SESSION_MINUTES * 60;
}

// A connected account can take deposits once card payments are active on it.
// Anything else (pending, restricted, rejected, missing) means it can't, and
// the booking flow skips the deposit step.
export function canTakeCardPayments(account: {
  configuration?: {
    merchant?: { capabilities?: { card_payments?: { status?: string } } } | null;
  } | null;
}) {
  return account.configuration?.merchant?.capabilities?.card_payments?.status === "active";
}

export function depositStatusAfterRefund(charge: { amount: number; amount_refunded: number }) {
  return charge.amount_refunded >= charge.amount ? "refunded" : "partially_refunded";
}
