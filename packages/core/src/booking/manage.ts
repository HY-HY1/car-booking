import "server-only";
import { z } from "zod";
import { bookingChanged } from "./changed";
import { notifyCustomerCancelled, notifyCustomerRescheduled, notifySlotOpened } from "../email/notify";
import { policyLines, policyOf, refundAdvice, type CancellationPolicy } from "../settings/policy";
import { getTenantPayments } from "../stripe/accounts";
import { createDepositCheckout, depositDescription } from "../stripe/checkout";
import { loadBookingPayments } from "../stripe/ledger";
import { createBookingBalanceLink } from "../stripe/payment-links";
import { PAYABLE_BOOKING_STATUSES, paymentSummary } from "../stripe/payment-rules";
import { createAdminClient } from "../supabase/admin";
import { tenantUrl } from "../urls";
import { dayRange } from "./availability";
import { bookableDatesFor, openSlots } from "./capacity";
import type { LocationType } from "./config";
import { getBookingConfig, loadBusyByResource, type BookingConfig, type EngineResult, type Slot } from "./engine";
import { customerOptions, depositOwed, refundLine, verifyManageToken, type CustomerOptions } from "./manage-rules";
import { isIsoDate, localDate, localTime } from "./time";

// A customer cancelling or moving their own booking, from the signed link in
// their emails (manage-link.ts). Every call takes the token, not a booking
// id, and checks it against the business for this hostname; the policy is
// read again on every change, so a cut-off that's passed since the page was
// opened still stops it. Refunds aren't made here: the business is told what
// the policy says and refunds from the booking's page.

function fail(code: string, message: string) {
  return { ok: false as const, code, message };
}

const LIVE = ["confirmed", "requested"];

type Row = {
  id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  resource_id: string;
  location_type: LocationType;
  address_line: string | null;
  postcode: string;
  price_pence: number;
  deposit_pence: number;
  deposit_status: string;
  reschedule_count: number;
  service: { name: string } | null;
  customer: { name: string; email: string | null } | null;
};

const FIELDS =
  "id, status, starts_at, ends_at, resource_id, location_type, address_line, postcode, price_pence, deposit_pence, deposit_status, reschedule_count, service:services(name), customer:customers(name, email)";

type Loaded = { row: Row; policy: CancellationPolicy | null; timezone: string };

function owes(row: Row) {
  return depositOwed({ status: row.status, depositPence: row.deposit_pence, depositStatus: row.deposit_status });
}

async function load(tenantId: string, token: string): Promise<Loaded | null> {
  const secret = process.env.BOOKING_LINK_SECRET;
  if (!secret) return null;
  const bookingId = await verifyManageToken(secret, tenantId, token);
  if (!bookingId) return null;

  const db = createAdminClient();
  const [booking, settings] = await Promise.all([
    db.from("bookings").select(FIELDS).eq("tenant_id", tenantId).eq("id", bookingId).maybeSingle(),
    db.from("booking_settings").select("timezone, cancellation_policy").eq("tenant_id", tenantId).maybeSingle(),
  ]);
  if (booking.error) throw booking.error;
  if (settings.error) throw settings.error;
  if (!booking.data) return null;
  return {
    row: booking.data as unknown as Row,
    policy: policyOf(settings.data?.cancellation_policy),
    timezone: settings.data?.timezone ?? "Europe/London",
  };
}

function optionsFor(l: Loaded, now = new Date()) {
  return customerOptions(l.policy, { status: l.row.status, startsAt: l.row.starts_at, rescheduleCount: l.row.reschedule_count }, now);
}

function paidDeposit(row: Row) {
  return row.deposit_status === "paid" ? row.deposit_pence : 0;
}

// ---------------------------------------------------------------- the page

export type ManagedBooking = {
  status: string;
  serviceName: string | null;
  customerName: string | null;
  startsAt: string;
  endsAt: string;
  timezone: string;
  locationType: LocationType;
  address: string;
  pricePence: number;
  depositPence: number;
  depositStatus: string;
  options: CustomerOptions;
  // The policy, a sentence per line; null = none set.
  policy: CancellationPolicy | null;
  policyLines: string[] | null;
  // What cancelling now would mean for the deposit.
  refundLine: string | null;
  // The deposit is still to pay, and can be paid online now.
  canPayDeposit: boolean;
  // What's still owed once any deposit is sorted; 0 when nothing can be paid here.
  balanceToPayPence: number;
  bookingId: string;
  // Whether there's anything to bill yet.
  hasInvoice: boolean;
};

export async function getManagedBooking(tenantId: string, token: string): Promise<ManagedBooking | null> {
  const l = await load(tenantId, token);
  if (!l) return null;
  const { row, policy } = l;
  const paid = paidDeposit(row);
  const payments = await getTenantPayments(tenantId);
  const canPayDeposit = owes(row) && payments.ready;
  const payable = (PAYABLE_BOOKING_STATUSES as readonly string[]).includes(row.status);
  // The balance waits until any deposit has been dealt with, so nobody is
  // offered two ways to pay the same money.
  const balanceToPayPence =
    payable && payments.ready && !owes(row) ? paymentSummary(row, await loadBookingPayments(tenantId, row.id)).balancePence : 0;
  return {
    bookingId: row.id,
    hasInvoice: payable,
    balanceToPayPence,
    status: row.status,
    serviceName: row.service?.name ?? null,
    customerName: row.customer?.name ?? null,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    timezone: l.timezone,
    locationType: row.location_type,
    address: [row.address_line, row.postcode].filter(Boolean).join(", "),
    pricePence: row.price_pence,
    depositPence: row.deposit_pence,
    depositStatus: row.deposit_status,
    options: optionsFor(l),
    policy,
    policyLines: policy ? policyLines(policy, row.deposit_pence > 0) : null,
    refundLine: refundLine(refundAdvice(policy, { startsAt: row.starts_at, depositPaidPence: paid }), paid),
    canPayDeposit,
  };
}

// ---------------------------------------------------------------- the balance

// "Pay the balance": the same one-off Stripe link the business would send for
// what's owed. The amount is worked out on the server from the booking.
export async function startBalancePayment(tenantId: string, token: string): Promise<EngineResult<{ url: string }>> {
  const l = await load(tenantId, token);
  if (!l) return fail("not_found", "We couldn't find that booking.");
  const link = await createBookingBalanceLink(tenantId, null, l.row.id, { reuse: true });
  if (!link.ok) return fail("unavailable", link.message);
  return { ok: true, url: link.link.url };
}

// The verified booking id behind a link, for the invoice.
export async function bookingIdFromToken(tenantId: string, token: string) {
  return (await load(tenantId, token))?.row.id ?? null;
}

// ---------------------------------------------------------------- the deposit

// "Pay deposit" on the booking page: a Stripe checkout for the deposit still
// owed. The webhook marks it paid (stripe/payments.ts confirmPaidBooking, which
// leaves a live booking's status alone), and Stripe brings the customer back
// to this page. A fresh session each half hour, so a click on an old email
// still works and a double click doesn't make two.
export async function startDepositPayment(
  tenant: { id: string; slug: string; customDomain: string | null },
  token: string,
): Promise<EngineResult<{ url: string }>> {
  const l = await load(tenant.id, token);
  if (!l) return fail("not_found", "We couldn't find that booking.");
  const { row } = l;
  if (!owes(row)) return fail("nothing_to_pay", "There's no deposit to pay on this booking.");
  const payments = await getTenantPayments(tenant.id);
  if (!payments.ready || !payments.accountId) return fail("unavailable", "Deposits can't be paid online right now. Get in touch with the business.");
  if (!row.customer?.email) return fail("no_email", "We need your email address for the receipt. Get in touch with the business.");

  const url = await createDepositCheckout({
    tenantId: tenant.id,
    bookingId: row.id,
    leadId: null,
    stripeAccountId: payments.accountId,
    depositPence: row.deposit_pence,
    description: depositDescription(row.service?.name ?? "Booking", new Date(row.starts_at), l.timezone),
    customerEmail: row.customer.email,
    confirmedUrl: tenantUrl(tenant.slug, `/manage/${token}`, { absolute: true, customDomain: tenant.customDomain }),
    idempotencyKey: `deposit-${row.id}-${Math.floor(Date.now() / (30 * 60_000))}`,
  });
  return { ok: true, url };
}

// ---------------------------------------------------------------- new times

type Job = { config: BookingConfig; row: Row; durationMins: number };

// The booking, if it can be moved now, with what's needed to look for times.
async function movable(tenantId: string, token: string): Promise<EngineResult<Job>> {
  const l = await load(tenantId, token);
  if (!l) return fail("not_found", "We couldn't find that booking.");
  if (!optionsFor(l).reschedule.allowed) return fail("not_allowed", "This booking can't be changed online any more.");
  const config = await getBookingConfig(tenantId);
  if (!config) return fail("not_allowed", "This booking can't be changed online any more.");
  const durationMins = Math.round((new Date(l.row.ends_at).getTime() - new Date(l.row.starts_at).getTime()) / 60_000);
  return { ok: true, config, row: l.row, durationMins };
}

type Busy = Awaited<ReturnType<typeof loadBusyByResource>>;

// Free start times on a day for the same job: same length, same place, any
// van or bay that does that kind of job, leaving this booking's own time out.
// The van it's on comes first, so a move keeps the same van when it can.
function offersOn(job: Job, date: string, busyByResource: Busy, now: Date) {
  return openSlots({
    date,
    durationMins: job.durationMins,
    locationType: job.row.location_type,
    settings: job.config.settings,
    resources: job.config.resources,
    busyByResource,
    now,
  }).map((o) => ({
    start: o.start,
    resourceIds: [...o.resourceIds].sort((a, b) => Number(b === job.row.resource_id) - Number(a === job.row.resource_id)),
  }));
}

function busyBetween(job: Job, from: Date, to: Date) {
  return loadBusyByResource(
    createAdminClient(),
    job.config.settings.tenant_id,
    job.config.settings,
    job.config.resources,
    from,
    to,
    job.row.postcode,
    job.row.location_type,
    job.row.id,
  );
}

export async function findRescheduleDates(tenantId: string, token: string): Promise<EngineResult<{ today: string; dates: string[] }>> {
  const job = await movable(tenantId, token);
  if (!job.ok) return job;
  const { settings, resources } = job.config;
  const now = new Date();
  const today = localDate(now, settings.timezone);
  const candidates = bookableDatesFor(settings, resources, job.row.location_type, now);
  if (candidates.length === 0) return { ok: true, today, dates: [] };

  const from = dayRange(candidates[0], settings.timezone).from;
  const to = dayRange(candidates[candidates.length - 1], settings.timezone).to;
  const busy = await busyBetween(job, from, to);
  return { ok: true, today, dates: candidates.filter((date) => offersOn(job, date, busy, now).length > 0) };
}

export async function findRescheduleSlots(
  tenantId: string,
  token: string,
  date: string,
): Promise<EngineResult<{ date: string; slots: Slot[] }>> {
  if (!isIsoDate(date)) return fail("invalid_input", "Pick a date.");
  const job = await movable(tenantId, token);
  if (!job.ok) return job;
  const { from, to } = dayRange(date, job.config.settings.timezone);
  const offers = offersOn(job, date, await busyBetween(job, from, to), new Date());
  return {
    ok: true,
    date,
    slots: offers.map((o) => ({ startsAt: o.start.toISOString(), time: localTime(o.start, job.config.settings.timezone) })),
  };
}

// ---------------------------------------------------------------- changes

export async function rescheduleBooking(
  tenantId: string,
  token: string,
  startsAt: string,
): Promise<EngineResult<{ startsAt: string }>> {
  const when = z.iso.datetime({ offset: true }).safeParse(startsAt);
  if (!when.success) return fail("invalid_input", "Pick a time.");
  const job = await movable(tenantId, token);
  if (!job.ok) return job;
  const { row } = job;
  const start = new Date(when.data);
  if (start.getTime() === new Date(row.starts_at).getTime()) return fail("same_time", "That's the time you're already booked for.");

  // The time is checked again here, as in hold_slot: it may have gone since
  // the customer saw it.
  const date = localDate(start, job.config.settings.timezone);
  const { from, to } = dayRange(date, job.config.settings.timezone);
  const offer = offersOn(job, date, await busyBetween(job, from, to), new Date()).find(
    (o) => o.start.getTime() === start.getTime(),
  );
  if (!offer) return fail("slot_taken", "Sorry, that time has just gone. Pick another.");

  const db = createAdminClient();
  const patch = {
    starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + job.durationMins * 60_000).toISOString(),
    rescheduled_at: new Date().toISOString(),
    rescheduled_from: row.starts_at,
    reschedule_count: row.reschedule_count + 1,
  };
  // Only if nothing has changed since it was read: a second tab, or the
  // business moving or cancelling it meanwhile. 23P01: someone took that van
  // in the moment between the check and the update; try the next.
  for (const resourceId of offer.resourceIds) {
    const { data, error } = await db
      .from("bookings")
      .update({ ...patch, resource_id: resourceId })
      .eq("tenant_id", tenantId)
      .eq("id", row.id)
      .in("status", LIVE)
      .eq("starts_at", row.starts_at)
      .eq("reschedule_count", row.reschedule_count)
      .select("id");
    if (error?.code === "23P01") continue;
    if (error) throw error;
    if (!data.length) return fail("changed", "Your booking has just changed. Reload the page to see it.");

    await notifyCustomerRescheduled(tenantId, row.id, { from: row.starts_at });
    await bookingChanged(tenantId, row.id);
    return { ok: true, startsAt: patch.starts_at };
  }
  return fail("slot_taken", "Sorry, that time has just gone. Pick another.");
}

export async function cancelBookingAsCustomer(
  tenantId: string,
  token: string,
): Promise<EngineResult<{ refundLine: string | null }>> {
  const l = await load(tenantId, token);
  if (!l) return fail("not_found", "We couldn't find that booking.");
  if (!optionsFor(l).cancel.allowed) return fail("not_allowed", "This booking can't be cancelled online any more.");

  const db = createAdminClient();
  const { data, error } = await db
    .from("bookings")
    .update({ status: "cancelled", cancelled_by: "customer" })
    .eq("tenant_id", tenantId)
    .eq("id", l.row.id)
    .eq("status", l.row.status)
    .eq("starts_at", l.row.starts_at)
    .select("id");
  if (error) throw error;
  if (!data.length) return fail("changed", "Your booking has just changed. Reload the page to see it.");

  const paid = paidDeposit(l.row);
  const advice = refundAdvice(l.policy, { startsAt: l.row.starts_at, depositPaidPence: paid });
  await notifyCustomerCancelled(tenantId, l.row.id, { advice });
  await bookingChanged(tenantId, l.row.id);
  await notifySlotOpened(tenantId, l.row.id);
  return { ok: true, refundLine: refundLine(advice, paid) };
}
