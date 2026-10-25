import "server-only";
import type Stripe from "stripe";
import { createAdminClient } from "../supabase/admin";
import { getTenantPayments } from "./accounts";
import { getStripe } from "./client";
import { paymentStatus, toPaymentRow, type ChargeLike, type PaymentRow } from "./payment-rules";

// The record of what has been paid on each booking (booking_payments). Stripe
// is the source of truth; this is a copy that's kept current three ways: the
// webhook writes a payment the moment it happens, a booking page re-reads
// Stripe and fills in anything missing, and refunds update the amount.

type LedgerRow = {
  stripe_charge_id: string;
  stripe_payment_intent_id: string | null;
  kind: "deposit" | "payment_link" | "other";
  amount_pence: number;
  refunded_pence: number;
  receipt_url: string | null;
  paid_at: string;
};

function toLedgerRow(tenantId: string, bookingId: string, p: PaymentRow) {
  return {
    stripe_charge_id: p.id,
    tenant_id: tenantId,
    booking_id: bookingId,
    stripe_payment_intent_id: p.paymentIntentId,
    kind: p.source,
    amount_pence: p.amountPence,
    refunded_pence: p.refundedPence,
    receipt_url: p.receiptUrl,
    paid_at: p.createdAt,
  };
}

function fromLedgerRow(r: LedgerRow): PaymentRow {
  const base = { amount_refunded: r.refunded_pence, status: "succeeded", disputed: false, refunded: r.refunded_pence >= r.amount_pence && r.amount_pence > 0 };
  return {
    id: r.stripe_charge_id,
    createdAt: r.paid_at,
    amountPence: r.amount_pence,
    refundedPence: r.refunded_pence,
    feePence: null,
    netPence: null,
    status: paymentStatus(base),
    source: r.kind,
    description: null,
    customerName: null,
    customerEmail: null,
    receiptUrl: r.receipt_url,
    paymentIntentId: r.stripe_payment_intent_id,
    bookingId: null,
  };
}

async function upsert(tenantId: string, bookingId: string, payments: PaymentRow[]) {
  if (payments.length === 0) return;
  const { error } = await createAdminClient()
    .from("booking_payments")
    .upsert(payments.map((p) => toLedgerRow(tenantId, bookingId, p)), { onConflict: "stripe_charge_id" });
  if (error) throw error;
}

// ---------------------------------------------------------------- webhook

// A Checkout Session for a booking was paid: record the charge. Covers the
// deposit and payment links alike.
export async function recordPaidSession(accountId: string, session: Stripe.Checkout.Session) {
  const bookingId = session.metadata?.booking_id;
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (!bookingId || !paymentIntentId) return;

  const db = createAdminClient();
  const tenant = await db.from("tenants").select("id").eq("stripe_account_id", accountId).maybeSingle();
  if (tenant.error) throw tenant.error;
  if (!tenant.data) return;
  // The booking id comes from metadata, so it's only used if it's this tenant's.
  const booking = await db.from("bookings").select("id").eq("tenant_id", tenant.data.id).eq("id", bookingId).maybeSingle();
  if (booking.error) throw booking.error;
  if (!booking.data) return;

  const pi = await getStripe().paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] }, { stripeAccount: accountId });
  const charge = pi.latest_charge;
  if (!charge || typeof charge === "string") return;

  const row = toPaymentRow(charge as unknown as ChargeLike);
  await upsert(tenant.data.id, booking.data.id, [
    { ...row, source: session.payment_link ? "payment_link" : "deposit" },
  ]);
}

// charge.refunded: the charge's refunded total changed.
export async function recordRefund(accountId: string | undefined | null, chargeId: string, refundedPence: number) {
  if (!accountId) return;
  const db = createAdminClient();
  const tenant = await db.from("tenants").select("id").eq("stripe_account_id", accountId).maybeSingle();
  if (tenant.error) throw tenant.error;
  if (!tenant.data) return;
  const { error } = await db
    .from("booking_payments")
    .update({ refunded_pence: refundedPence })
    .eq("tenant_id", tenant.data.id)
    .eq("stripe_charge_id", chargeId);
  if (error) throw error;
}

// ---------------------------------------------------------------- reading

// What Stripe has for one booking, found by routes that are up to date the
// moment a payment is made: the deposit's payment, and the sessions of each
// payment link made for the booking. A search by booking id catches anything
// else, but Stripe's search can lag by a minute, so it only adds to the rest.
async function fetchFromStripe(tenantId: string, booking: { id: string; stripe_payment_intent_id: string | null }) {
  const { accountId } = await getTenantPayments(tenantId);
  if (!accountId) return null;
  const stripe = getStripe();
  const opts = { stripeAccount: accountId };
  const db = createAdminClient();

  const paymentIntents = new Set<string>();
  if (booking.stripe_payment_intent_id) paymentIntents.add(booking.stripe_payment_intent_id);

  const links = await db.from("payment_links").select("stripe_payment_link_id").eq("tenant_id", tenantId).eq("booking_id", booking.id);
  if (links.error) throw links.error;
  for (const link of links.data) {
    const sessions = await stripe.checkout.sessions.list({ payment_link: link.stripe_payment_link_id, limit: 100 }, opts);
    for (const s of sessions.data) {
      const pi = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id;
      if (s.payment_status === "paid" && pi) paymentIntents.add(pi);
    }
  }

  const found = new Map<string, PaymentRow>();
  const add = (c: unknown) => {
    const row = toPaymentRow(c as ChargeLike);
    if (row.status !== "failed") found.set(row.id, row);
  };

  try {
    const searched = await stripe.charges.search({ query: `metadata['booking_id']:'${booking.id}'`, limit: 50 }, opts);
    searched.data.forEach(add);
  } catch (error) {
    console.error("Stripe charge search failed", error);
  }

  const known = new Set([...found.values()].map((r) => r.paymentIntentId));
  for (const id of paymentIntents) {
    if (known.has(id)) continue;
    const pi = await stripe.paymentIntents.retrieve(id, { expand: ["latest_charge"] }, opts);
    if (pi.latest_charge && typeof pi.latest_charge !== "string") add(pi.latest_charge);
  }

  // Which charge belongs to a link or the deposit decides its label, but the
  // booking id on the charge is the only thing tying it to this booking.
  return [...found.values()];
}

// Every payment on a booking, newest first. Brings the ledger up to date from
// Stripe first; if Stripe can't be reached, or the ledger can't be read, the
// other one is used on its own.
export async function loadBookingPayments(tenantId: string, bookingId: string): Promise<PaymentRow[]> {
  const db = createAdminClient();
  const booking = await db
    .from("bookings")
    .select("id, stripe_payment_intent_id")
    .eq("tenant_id", tenantId)
    .eq("id", bookingId)
    .maybeSingle();
  if (booking.error) throw booking.error;
  if (!booking.data) return [];

  let live: PaymentRow[] | null = null;
  try {
    live = await fetchFromStripe(tenantId, booking.data);
    if (live) await upsert(tenantId, booking.data.id, live);
  } catch (error) {
    console.error("Couldn't refresh a booking's payments from Stripe", error);
  }

  const stored = await db
    .from("booking_payments")
    .select("stripe_charge_id, stripe_payment_intent_id, kind, amount_pence, refunded_pence, receipt_url, paid_at")
    .eq("tenant_id", tenantId)
    .eq("booking_id", bookingId);
  const rows = stored.error ? null : (stored.data as LedgerRow[]).map(fromLedgerRow);
  if (stored.error) console.error("Couldn't read the payments ledger", stored.error);

  // The ledger wins where it has the charge (it carries refunds); the live
  // read covers a ledger that's missing or unreadable.
  const byId = new Map<string, PaymentRow>();
  for (const r of live ?? []) byId.set(r.id, r);
  for (const r of rows ?? []) byId.set(r.id, { ...byId.get(r.id), ...r });
  return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// Paid so far per booking, for the bookings list. Reads the ledger only (no
// Stripe calls), so a list of 200 bookings stays one query.
export async function paidByBooking(tenantId: string, bookingIds: string[]) {
  const paid = new Map<string, number>();
  if (bookingIds.length === 0) return paid;
  const { data, error } = await createAdminClient()
    .from("booking_payments")
    .select("booking_id, amount_pence, refunded_pence")
    .eq("tenant_id", tenantId)
    .in("booking_id", bookingIds);
  if (error) {
    console.error("Couldn't read the payments ledger", error);
    return paid;
  }
  for (const r of data) paid.set(r.booking_id, (paid.get(r.booking_id) ?? 0) + r.amount_pence - r.refunded_pence);
  return paid;
}
