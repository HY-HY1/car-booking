import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { formatPence } from "../booking/config";
import { manageBookingUrl } from "../booking/manage-link";
import { depositOwed, refundLine } from "../booking/manage-rules";
import { signUnsubscribeToken } from "../privacy/rules";
import { notificationsOf, renderTemplate, type NotificationSettings, type TemplateField } from "../settings/notifications";
import type { RefundAdvice } from "../settings/policy";
import { createAdminClient } from "../supabase/admin";
import { isCustomHostname } from "../tenants";
import { adminUrl, appUrl, tenantUrl } from "../urls";
import type { StripeAlert } from "../stripe/alerts";
import { getStripe } from "../stripe/client";
import { loadBookingPayments } from "../stripe/ledger";
import { paymentSummary } from "../stripe/payment-rules";
import { PRODUCT_NAME } from "../brand";
import { emailBrandOf } from "../branding/email-brand";
import {
  cancelled,
  cancelledByCustomer,
  customerFooter,
  declined,
  depositRequest,
  firstName,
  formatClock,
  formatDay,
  fromHeader,
  lateRefund,
  ownerCancellation,
  ownerDispute,
  ownerFooter,
  ownerLateRefund,
  ownerNewBooking,
  ownerNewLead,
  ownerPaymentProblem,
  ownerRescheduled,
  paymentReceived,
  paymentRequest,
  renderEmail,
  requestReceived,
  rescheduled,
  templateMessage,
  tidyAddress,
  type BookingFacts,
  type Composed,
  type EmailBrand,
  type OwnerFacts,
} from "./compose";
import { flexibleJobs } from "../booking/waitlist";
import { afterJobDue, CATCH_UP_DAYS, leadAlertDue, reminderDue, scheduledWindows } from "./schedule";
import { verifiedSender } from "./senders-server";
import { deliver, fromAddress, type SendResult } from "./transport";

// Sends the emails: what a booking, an enquiry or a Stripe event means for
// the customer and the business, and the scheduled reminders and follow-ups.
// Every exported function is best-effort and never throws: a failed email is
// logged (email_log, and the console) but never undoes a booking or fails a
// webhook. Each message is claimed in email_log before it's sent, so calling
// these twice for the same thing sends it once.

type Db = SupabaseClient;

const DEFAULT_TIMEZONE = "Europe/London";

export type EmailKind =
  | "confirmation"
  | "request_received"
  | "declined"
  | "cancelled"
  | "late_refund"
  | "reminder"
  | "follow_up"
  | "review_request"
  | "payment_link"
  | "payment_received"
  | "rescheduled"
  | "deposit_request"
  | "quote_follow_up"
  | "rebook_reminder"
  | "slot_opened"
  | "campaign"
  | "owner_new_booking"
  | "owner_cancellation"
  | "owner_new_lead"
  | "owner_dispute"
  | "owner_late_refund"
  | "owner_payment_problem"
  | "owner_rescheduled";

async function quietly(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (error) {
    console.error(`[email] ${label} failed`, error);
  }
}

// A page of the business's dashboard, as a full URL for an email.
function dashboardUrl(slug: string, path = "") {
  return appUrl(`/${slug}${path}`, { absolute: true });
}

// ---------------------------------------------------------------- the business

type TenantContext = {
  id: string;
  name: string;
  slug: string;
  contactEmail: string | null;
  // How its customer emails look and sign off: logo, colours, contact details.
  brand: EmailBrand;
  settings: NotificationSettings;
  timezone: string;
  // Its verified custom domain, if any: where its booking pages live in subdomain mode.
  customDomain: string | null;
  // The booking page (tenantUrl), e.g. https://shine.domain.com
  siteUrl: string;
  // Where alerts go: the address in Settings → Notifications, else the owner's login.
  alertEmail: () => Promise<string | null>;
  // Its own verified sending address (email_senders), if it has one.
  senderAddress: string | null;
};

async function loadTenant(db: Db, tenantId: string): Promise<TenantContext | null> {
  const [tenant, settings, domain, senderAddress] = await Promise.all([
    db
      .from("tenants")
      .select("id, name, slug, contact_email, contact_phone, branding, notification_settings")
      .eq("id", tenantId)
      .maybeSingle(),
    db.from("booking_settings").select("timezone").eq("tenant_id", tenantId).maybeSingle(),
    db.from("domains").select("hostname, verified, is_primary").eq("tenant_id", tenantId),
    verifiedSender(tenantId, db),
  ]);
  if (tenant.error) throw tenant.error;
  if (settings.error) throw settings.error;
  if (domain.error) throw domain.error;
  if (!tenant.data) return null;

  const t = tenant.data;
  const notifications = notificationsOf(t.notification_settings);
  const customDomain =
    domain.data?.find((d) => d.verified && d.is_primary && isCustomHostname(d.hostname))?.hostname ?? null;
  let ownerEmail: Promise<string | null> | undefined;
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    contactEmail: t.contact_email ?? null,
    brand: emailBrandOf({ name: t.name, contactEmail: t.contact_email, contactPhone: t.contact_phone, branding: t.branding }),
    settings: notifications,
    timezone: settings.data?.timezone ?? DEFAULT_TIMEZONE,
    customDomain,
    siteUrl: tenantUrl(t.slug, "/", { absolute: true, customDomain }),
    senderAddress,
    alertEmail: () => {
      if (notifications.alerts.email) return Promise.resolve(notifications.alerts.email);
      ownerEmail ??= ownerLoginEmail(db, tenantId);
      return ownerEmail;
    },
  };
}

async function ownerLoginEmail(db: Db, tenantId: string) {
  const { data, error } = await db
    .from("tenant_members")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("role", "owner")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const user = await db.auth.admin.getUserById(data.user_id);
  if (user.error) throw user.error;
  return user.data.user?.email ?? null;
}

// ---------------------------------------------------------------- bookings

type BookingContext = {
  id: string;
  status: string;
  startsAt: Date;
  endsAt: Date;
  createdAt: Date;
  address: string;
  pricePence: number;
  depositPence: number;
  depositStatus: string;
  declineReason: string | null;
  // Times the customer has moved it, and when last: a moved booking gets a
  // new reminder, unless it was moved to within the reminder window.
  rescheduleCount: number;
  rescheduledAt: Date | null;
  service: string;
  customer: { id: string; name: string; email: string | null; phone: string | null; emailMarketing: boolean };
};

const BOOKING_FIELDS =
  "id, tenant_id, status, starts_at, ends_at, created_at, address_line, postcode, price_pence, deposit_pence, deposit_status, decline_reason, reschedule_count, rescheduled_at, customer:customers(id, name, email, phone, email_marketing), service:services(name)";

type BookingRow = {
  id: string;
  tenant_id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  created_at: string;
  address_line: string | null;
  postcode: string | null;
  price_pence: number;
  deposit_pence: number;
  deposit_status: string;
  decline_reason: string | null;
  reschedule_count: number;
  rescheduled_at: string | null;
  customer: { id: string; name: string; email: string | null; phone: string | null; email_marketing: boolean } | null;
  service: { name: string } | null;
};

function toBooking(row: BookingRow): BookingContext | null {
  if (!row.customer) return null;
  return {
    id: row.id,
    status: row.status,
    startsAt: new Date(row.starts_at),
    endsAt: new Date(row.ends_at),
    createdAt: new Date(row.created_at),
    address: [row.address_line, row.postcode].filter(Boolean).join(", "),
    pricePence: row.price_pence,
    depositPence: row.deposit_pence,
    depositStatus: row.deposit_status,
    declineReason: row.decline_reason,
    rescheduleCount: row.reschedule_count,
    rescheduledAt: row.rescheduled_at ? new Date(row.rescheduled_at) : null,
    service: row.service?.name ?? "your booking",
    customer: {
      id: row.customer.id,
      name: row.customer.name,
      email: row.customer.email,
      phone: row.customer.phone,
      emailMarketing: row.customer.email_marketing,
    },
  };
}

async function loadBooking(db: Db, tenantId: string, bookingId: string) {
  const { data, error } = await db.from("bookings").select(BOOKING_FIELDS).eq("tenant_id", tenantId).eq("id", bookingId).maybeSingle();
  if (error) throw error;
  return data ? toBooking(data as unknown as BookingRow) : null;
}

function bookingFacts(t: TenantContext, b: BookingContext): BookingFacts {
  return {
    customerName: b.customer.name,
    businessName: t.name,
    service: b.service,
    date: formatDay(b.startsAt, t.timezone),
    time: formatClock(b.startsAt, t.timezone),
    address: tidyAddress(b.address),
    bookingLink: t.siteUrl,
  };
}

// What the booking costs and what's been paid towards it, for the confirmation.
function moneyOf(b: BookingContext) {
  return { pricePence: b.pricePence, depositPaidPence: b.depositStatus === "paid" ? b.depositPence : 0 };
}

// `manageLink`: the customer's link to cancel or move this booking, where the
// message has one.
function templateValues(t: TenantContext, b: BookingContext, manageLink = ""): Record<TemplateField, string> {
  const f = bookingFacts(t, b);
  return {
    customer_name: firstName(f.customerName),
    business_name: f.businessName,
    service: f.service,
    date: f.date,
    time: f.time,
    address: f.address,
    booking_link: f.bookingLink,
    manage_link: manageLink,
    review_link: t.settings.messages.review_request.review_url ?? "",
  };
}

function ownerFacts(t: TenantContext, b: BookingContext): OwnerFacts {
  const f = bookingFacts(t, b);
  return {
    customerName: b.customer.name,
    customerEmail: b.customer.email,
    customerPhone: b.customer.phone,
    service: f.service,
    date: f.date,
    time: f.time,
    address: f.address,
    link: dashboardUrl(t.slug, `/bookings/${b.id}`),
  };
}

// ---------------------------------------------------------------- sending

type Message = {
  kind: EmailKind;
  dedupeKey: string;
  bookingId?: string;
  leadId?: string;
  customerId?: string;
  to: string;
  content: Composed;
  marketing?: { customerId: string };
};

// Claims the message in the log, then sends it. A second claim of the same
// dedupe key is refused by the unique index, and that message is skipped.
// The customer's address bounced for good before (the Resend webhook set
// email_bounced_at), so sending again would only hurt the business's sending
// reputation. Changing the customer's email clears it. Before the column
// exists (migration not applied yet) nothing is treated as bounced.
async function bouncedBefore(db: Db, tenantId: string, customerId: string | undefined, to: string) {
  if (!customerId) return false;
  const { data, error } = await db
    .from("customers")
    .select("email, email_bounced_at")
    .eq("tenant_id", tenantId)
    .eq("id", customerId)
    .maybeSingle();
  if (error) {
    if (error.code !== "42703") console.error("[email] couldn't check for an earlier bounce", error);
    return false;
  }
  return !!data?.email_bounced_at && data.email?.toLowerCase() === to.toLowerCase();
}

async function send(db: Db, t: TenantContext, m: Message): Promise<"sent" | "failed" | "duplicate" | "skipped"> {
  const audience = m.kind.startsWith("owner_") ? "owner" : "customer";
  let unsubscribeUrl: string | undefined;
  let oneClickUrl: string | undefined;
  if (m.marketing) {
    // Marketing has to carry a working opt-out; without one it isn't sent.
    const secret = process.env.PRIVACY_TOKEN_SECRET;
    if (!secret) return "skipped";
    const token = await signUnsubscribeToken(secret, m.marketing.customerId, "email");
    const opts = { absolute: true, customDomain: t.customDomain };
    // The link asks before it unsubscribes; mail apps' own unsubscribe
    // button posts to the one-click address (RFC 8058).
    unsubscribeUrl = tenantUrl(t.slug, `/unsubscribe?t=${token}`, opts);
    oneClickUrl = tenantUrl(t.slug, `/unsubscribe/one-click?t=${token}`, opts);
  }

  const claim = await db
    .from("email_log")
    .insert({
      tenant_id: t.id,
      kind: m.kind,
      audience,
      dedupe_key: m.dedupeKey,
      booking_id: m.bookingId ?? null,
      lead_id: m.leadId ?? null,
      customer_id: m.customerId ?? null,
    })
    .select("id")
    .single();
  if (claim.error?.code === "23505") return "duplicate";
  if (claim.error) throw claim.error;

  const footer =
    audience === "customer"
      ? customerFooter(
          t.brand,
          m.marketing ? "marketing" : m.kind === "payment_link" ? "payment_link" : m.kind === "payment_received" ? "payment_received" : "booking",
        )
      : ownerFooter(t.name, dashboardUrl(t.slug, "/settings/notifications"));
  const { text, html } = renderEmail({ content: m.content, audience, brand: t.brand, footer, unsubscribeUrl });

  // Customers hear from the business's own address, so until it's verified
  // their emails aren't sent. Alerts to the business come from us, in our
  // name, so they stand apart from customers' replies in the owner's inbox.
  // Development without a key prints everything to the console regardless.
  const sender = audience === "owner" ? fromAddress() : (t.senderAddress ?? (!process.env.RESEND_API_KEY ? fromAddress() : null));
  const bounced = audience === "customer" && (await bouncedBefore(db, t.id, m.customerId, m.to));
  const result: SendResult = bounced
    ? { ok: false, error: "Not sent: this address bounced before. Check the customer's email address." }
    : !sender
      ? { ok: false, error: "No verified sending address: set one up in Settings → Notifications." }
      : await deliver({
          from: audience === "owner" ? fromHeader(PRODUCT_NAME, sender) : fromHeader(t.settings.sender_name ?? t.name, sender),
          to: m.to,
          replyTo: audience === "customer" ? (t.settings.reply_to ?? t.contactEmail) : null,
          subject: m.content.subject,
          text,
          html,
          headers: oneClickUrl
            ? { "List-Unsubscribe": `<${oneClickUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
            : undefined,
          idempotencyKey: `${t.id}:${m.dedupeKey}`.slice(0, 256),
        });

  const update = await db
    .from("email_log")
    .update(
      result.ok
        ? { status: "sent", provider_id: result.providerId, sent_at: new Date().toISOString() }
        : { status: "failed", error: result.error },
    )
    .eq("id", claim.data.id);
  if (update.error) throw update.error;
  if (!result.ok) console.error(`[email] ${m.kind} for ${t.slug} failed: ${result.error}`);
  return result.ok ? "sent" : "failed";
}

// Customers hear by email when the business has email on and we have an address.
function customerAddress(t: TenantContext, b: BookingContext) {
  return t.settings.channels.email ? b.customer.email : null;
}

function manageButton(url: string | null) {
  return url ? { label: "Manage your booking", url } : undefined;
}

// ---------------------------------------------------------------- the waiting list

const SLOT_OFFERS = 3;

// A job was cancelled: tells the customers who asked to come earlier and
// could fit in that time. Several hear, so it's first come, first served, and
// moving the booking checks the time is still free. It's off unless the
// business switches it on, and only for a time that's still ahead.
export async function notifySlotOpened(tenantId: string, bookingId: string) {
  await quietly("earlier time", async () => {
    const db = createAdminClient();
    const t = await loadTenant(db, tenantId);
    const template = t?.settings.messages.slot_opened;
    if (!t || !template?.enabled || !t.settings.channels.email) return;

    const { data: freed, error } = await db
      .from("bookings")
      .select("starts_at, ends_at, location_type")
      .eq("tenant_id", tenantId)
      .eq("id", bookingId)
      .maybeSingle();
    if (error) throw error;
    if (!freed || new Date(freed.starts_at).getTime() <= Date.now()) return;

    const candidates = await flexibleJobs(tenantId, { startsAt: freed.starts_at, endsAt: freed.ends_at, locationType: freed.location_type }, SLOT_OFFERS);
    const start = new Date(freed.starts_at);
    for (const job of candidates) {
      const b = await loadBooking(db, tenantId, job.id);
      if (!b?.customer.email) continue;
      const manage = await manageBookingUrl(t, b.id);
      if (!manage) continue;
      const newTime = { date: formatDay(start, t.timezone), time: formatClock(start, t.timezone) };
      const values = { ...templateValues(t, b, manage), ...newTime };
      await send(db, t, {
        kind: "slot_opened",
        dedupeKey: `slot_opened:${b.id}:${freed.starts_at}`,
        bookingId: b.id,
        customerId: b.customer.id,
        to: b.customer.email,
        content: templateMessage(
          "slot_opened",
          { subject: renderTemplate(template.subject, values), body: renderTemplate(template.body, values) },
          { facts: { ...bookingFacts(t, b), ...newTime }, buttonUrl: manage },
        ),
      });
    }
  });
}

// ---------------------------------------------------------------- booking events

// A hold became a booking: confirmed, or a request the business approves.
// Tells the customer, and the business unless it did this itself (approving
// a request), in which case pass alertOwner: false.
export async function notifyBookingSecured(tenantId: string, bookingId: string, opts: { alertOwner?: boolean } = {}) {
  await quietly("booking secured", async () => {
    const db = createAdminClient();
    const [t, b] = await Promise.all([loadTenant(db, tenantId), loadBooking(db, tenantId, bookingId)]);
    if (!t || !b || (b.status !== "confirmed" && b.status !== "requested")) return;
    const requested = b.status === "requested";

    const to = customerAddress(t, b);
    const confirmation = t.settings.messages.confirmation;
    if (to && (requested || confirmation.enabled)) {
      const manage = await manageBookingUrl(t, b.id);
      const values = templateValues(t, b, manage ?? "");
      const content: Composed = requested
        ? { ...requestReceived(bookingFacts(t, b)), button: manageButton(manage) }
        : templateMessage(
            "confirmation",
            { subject: renderTemplate(confirmation.subject, values), body: renderTemplate(confirmation.body, values) },
            { facts: bookingFacts(t, b), money: moneyOf(b), buttonUrl: manage },
          );
      await send(db, t, {
        kind: requested ? "request_received" : "confirmation",
        dedupeKey: `${requested ? "request_received" : "confirmation"}:${b.id}`,
        bookingId: b.id,
        customerId: b.customer.id,
        to,
        content,
      });
    }

    // A request waits on the business, so it's sent even with new-booking alerts off.
    if (opts.alertOwner === false || (!requested && !t.settings.alerts.new_booking)) return;
    const owner = await t.alertEmail();
    if (!owner) return;
    await send(db, t, {
      kind: "owner_new_booking",
      dedupeKey: `owner_new_booking:${b.id}`,
      bookingId: b.id,
      to: owner,
      content: ownerNewBooking(ownerFacts(t, b), {
        needsApproval: requested,
        pricePence: b.pricePence,
        depositPaidPence: b.depositStatus === "paid" ? b.depositPence : null,
      }),
    });
  });
}

// The business turned a request down (any deposit has been refunded by now).
export async function notifyBookingDeclined(tenantId: string, bookingId: string) {
  await quietly("booking declined", async () => {
    const db = createAdminClient();
    const [t, b] = await Promise.all([loadTenant(db, tenantId), loadBooking(db, tenantId, bookingId)]);
    if (!t || !b || b.status !== "cancelled") return;
    const to = customerAddress(t, b);
    if (!to) return;
    await send(db, t, {
      kind: "declined",
      dedupeKey: `declined:${b.id}`,
      bookingId: b.id,
      customerId: b.customer.id,
      to,
      content: declined(bookingFacts(t, b), {
        reason: b.declineReason,
        refundedPence: b.depositStatus === "refunded" ? b.depositPence : null,
      }),
    });
  });
}

// Someone at the business cancelled a booking. `by` is their login email:
// the business isn't alerted about a cancellation its alert address made.
export async function notifyBookingCancelled(tenantId: string, bookingId: string, opts: { by: string | null; refundedPence?: number }) {
  await quietly("booking cancelled", async () => {
    const db = createAdminClient();
    const [t, b] = await Promise.all([loadTenant(db, tenantId), loadBooking(db, tenantId, bookingId)]);
    if (!t || !b || b.status !== "cancelled") return;

    const to = customerAddress(t, b);
    if (to) {
      await send(db, t, {
        kind: "cancelled",
        dedupeKey: `cancelled:${b.id}`,
        bookingId: b.id,
        customerId: b.customer.id,
        to,
        content: cancelled(bookingFacts(t, b), { depositPaid: b.depositStatus === "paid", refundedPence: opts.refundedPence }),
      });
    }

    if (!t.settings.alerts.cancellation) return;
    const owner = await t.alertEmail();
    if (!owner || owner.toLowerCase() === opts.by?.toLowerCase()) return;
    await send(db, t, {
      kind: "owner_cancellation",
      dedupeKey: `owner_cancellation:${b.id}`,
      bookingId: b.id,
      to: owner,
      content: ownerCancellation(ownerFacts(t, b), { by: opts.by }),
    });
  });
}

// The customer cancelled their own booking (booking/manage.ts). `advice` is
// what the policy says to refund: the business makes the refund, so it's
// told even with cancellation alerts off when there's money to give back.
export async function notifyCustomerCancelled(tenantId: string, bookingId: string, opts: { advice: RefundAdvice | null }) {
  await quietly("customer cancelled", async () => {
    const db = createAdminClient();
    const [t, b] = await Promise.all([loadTenant(db, tenantId), loadBooking(db, tenantId, bookingId)]);
    if (!t || !b || b.status !== "cancelled") return;
    const paid = b.depositStatus === "paid" ? b.depositPence : 0;

    const to = customerAddress(t, b);
    if (to) {
      await send(db, t, {
        kind: "cancelled",
        dedupeKey: `cancelled:${b.id}`,
        bookingId: b.id,
        customerId: b.customer.id,
        to,
        content: cancelledByCustomer(bookingFacts(t, b), {
          refund: refundLine(opts.advice, paid),
          refunding: (opts.advice?.refundPence ?? 0) > 0,
        }),
      });
    }

    const refundDue = (opts.advice?.refundPence ?? 0) > 0;
    if (!t.settings.alerts.cancellation && !refundDue) return;
    const owner = await t.alertEmail();
    if (!owner) return;
    const refund = opts.advice
      ? `${opts.advice.reason} ${refundDue ? `Refund ${formatPence(opts.advice.refundPence)} from the booking's page.` : ""}`.trim()
      : paid > 0
        ? `They paid a ${formatPence(paid)} deposit. You haven't set what happens to deposits, so it's your call: refund it from the booking's page.`
        : undefined;
    await send(db, t, {
      kind: "owner_cancellation",
      dedupeKey: `owner_cancellation:${b.id}`,
      bookingId: b.id,
      to: owner,
      content: ownerCancellation(ownerFacts(t, b), { by: "the customer", refund }),
    });
  });
}

// The customer moved their own booking; `from` is where it was.
export async function notifyCustomerRescheduled(tenantId: string, bookingId: string, opts: { from: string }) {
  await quietly("customer rescheduled", async () => {
    const db = createAdminClient();
    const [t, b] = await Promise.all([loadTenant(db, tenantId), loadBooking(db, tenantId, bookingId)]);
    if (!t || !b) return;
    const from = new Date(opts.from);
    const was = { fromDate: formatDay(from, t.timezone), fromTime: formatClock(from, t.timezone) };
    // One of each per move.
    const move = `${b.id}:${b.rescheduleCount}`;

    const to = customerAddress(t, b);
    if (to) {
      await send(db, t, {
        kind: "rescheduled",
        dedupeKey: `rescheduled:${move}`,
        bookingId: b.id,
        customerId: b.customer.id,
        to,
        content: rescheduled(bookingFacts(t, b), { ...was, manageUrl: await manageBookingUrl(t, b.id) }),
      });
    }

    if (!t.settings.alerts.cancellation) return;
    const owner = await t.alertEmail();
    if (!owner) return;
    await send(db, t, {
      kind: "owner_rescheduled",
      dedupeKey: `owner_rescheduled:${move}`,
      bookingId: b.id,
      to: owner,
      content: ownerRescheduled(ownerFacts(t, b), was),
    });
  });
}

// The business moved the booking from the diary. Just the customer: whoever
// moved it knows.
export async function notifyBookingMoved(tenantId: string, bookingId: string, opts: { from: string }) {
  await quietly("booking moved", async () => {
    const db = createAdminClient();
    const [t, b] = await Promise.all([loadTenant(db, tenantId), loadBooking(db, tenantId, bookingId)]);
    if (!t || !b) return;
    const to = customerAddress(t, b);
    if (!to) return;
    const from = new Date(opts.from);
    await send(db, t, {
      kind: "rescheduled",
      dedupeKey: `rescheduled:${b.id}:${b.rescheduledAt?.getTime()}`,
      bookingId: b.id,
      customerId: b.customer.id,
      to,
      content: rescheduled(bookingFacts(t, b), {
        fromDate: formatDay(from, t.timezone),
        fromTime: formatClock(from, t.timezone),
        manageUrl: await manageBookingUrl(t, b.id),
      }),
    });
  });
}

// Pressing "send" twice, or a form sent twice, within a minute sends one
// email: the window goes in the dedupe key, and an email of the same kind
// for the same thing in the last minute counts as this one.
const RESEND_AFTER_MS = 60_000;

function resendWindow(now = Date.now()) {
  return Math.floor(now / RESEND_AFTER_MS);
}

async function sentMomentsAgo(db: Db, tenantId: string, kind: EmailKind, about: { bookingId?: string; dedupePrefix?: string }) {
  let query = db
    .from("email_log")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("kind", kind)
    .in("status", ["sending", "sent"])
    .gt("created_at", new Date(Date.now() - RESEND_AFTER_MS).toISOString());
  if (about.bookingId) query = query.eq("booking_id", about.bookingId);
  if (about.dedupePrefix) query = query.like("dedupe_key", `${about.dedupePrefix}%`);
  const { count, error } = await query;
  if (error) throw error;
  return (count ?? 0) > 0;
}

// "Email deposit request" on a booking (and on adding one): asks the customer
// to pay the deposit from their booking page. Reports back, as the business
// pressed a button; each press sends again.
export async function emailDepositRequest(
  tenantId: string,
  bookingId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const db = createAdminClient();
    const [t, b, stripe] = await Promise.all([
      loadTenant(db, tenantId),
      loadBooking(db, tenantId, bookingId),
      db.from("tenants").select("stripe_ready").eq("id", tenantId).single(),
    ]);
    if (stripe.error) throw stripe.error;
    if (!t || !b) return { ok: false, message: "That booking wasn't found." };
    if (!depositOwed(b)) return { ok: false, message: "There's no deposit to pay on this booking." };
    if (!stripe.data.stripe_ready) return { ok: false, message: "Connect Stripe under Settings → Payments to take deposits online." };
    if (!b.customer.email) return { ok: false, message: "Add the customer's email address first." };
    if (!t.senderAddress && process.env.RESEND_API_KEY) {
      return { ok: false, message: "Set up your email address under Settings → Notifications first, so it comes from you." };
    }
    const payUrl = await manageBookingUrl(t, b.id);
    if (!payUrl) return { ok: false, message: "Customer booking links aren't set up yet (BOOKING_LINK_SECRET)." };
    if (await sentMomentsAgo(db, t.id, "deposit_request", { bookingId: b.id })) return { ok: true };

    const result = await send(db, t, {
      kind: "deposit_request",
      dedupeKey: `deposit_request:${b.id}:${resendWindow()}`,
      bookingId: b.id,
      customerId: b.customer.id,
      to: b.customer.email,
      content: depositRequest(bookingFacts(t, b), { depositPence: b.depositPence, payUrl }),
    });
    return result === "sent" ? { ok: true } : { ok: false, message: "The email couldn't be sent. Try again in a minute." };
  } catch (error) {
    console.error("[email] emailing a deposit request failed", error);
    return { ok: false, message: "The email couldn't be sent. Try again in a minute." };
  }
}

// ---------------------------------------------------------------- Stripe

// What Stripe told us that someone has to hear about (stripe/alerts.ts).
// These are about money, so they're sent whatever the alert settings say.
export async function notifyStripeAlert(alert: StripeAlert) {
  await quietly(`stripe alert ${alert.kind}`, async () => {
    const db = createAdminClient();
    if (alert.kind === "payment_problem") {
      const platform = process.env.PLATFORM_ALERT_EMAIL;
      const t = alert.tenantId ? await loadTenant(db, alert.tenantId) : null;
      const owner = t ? await t.alertEmail() : null;
      const content = ownerPaymentProblem(alert.detail, t ? dashboardUrl(t.slug, "/payments") : adminUrl("/", { absolute: true }));
      if (t && owner) {
        await send(db, t, {
          kind: "owner_payment_problem",
          dedupeKey: `owner_payment_problem:${alert.bookingId ?? alert.detail.slice(0, 120)}`,
          bookingId: alert.bookingId ?? undefined,
          to: owner,
          content,
        });
      }
      // The platform hears about every one, including those no business matched.
      if (platform) {
        const { text, html } = renderEmail({
          content: { ...content, body: `${content.body}\n\nBusiness: ${t?.slug ?? "none matched"}` },
          audience: "platform",
          brand: { name: PRODUCT_NAME },
          footer: ["Platform alert"],
        });
        const result = await deliver({
          from: fromHeader(`${PRODUCT_NAME} platform alerts`, fromAddress()),
          to: platform,
          subject: `[platform] ${content.subject}`,
          text,
          html,
          idempotencyKey: `platform:${alert.bookingId ?? alert.detail.slice(0, 120)}`,
        });
        if (!result.ok) console.error(`[email] platform alert failed: ${result.error}`);
      }
      return;
    }

    const t = await loadTenant(db, alert.tenantId);
    if (!t) return;
    const owner = await t.alertEmail();
    const b = alert.bookingId ? await loadBooking(db, alert.tenantId, alert.bookingId) : null;

    if (alert.kind === "dispute_opened") {
      if (!owner) return;
      await send(db, t, {
        kind: "owner_dispute",
        dedupeKey: `owner_dispute:${alert.disputeId}`,
        bookingId: b?.id,
        to: owner,
        content: ownerDispute(b ? ownerFacts(t, b) : null, {
          amountPence: alert.amountPence,
          link: b ? dashboardUrl(t.slug, `/bookings/${b.id}`) : dashboardUrl(t.slug, "/payments"),
        }),
      });
      return;
    }

    // late_payment_refunded: the customer is told why, and the business too.
    if (!b) return;
    const to = customerAddress(t, b);
    if (to) {
      await send(db, t, {
        kind: "late_refund",
        dedupeKey: `late_refund:${b.id}`,
        bookingId: b.id,
        customerId: b.customer.id,
        to,
        content: lateRefund(bookingFacts(t, b), { amountPence: b.depositPence }),
      });
    }
    if (owner) {
      await send(db, t, {
        kind: "owner_late_refund",
        dedupeKey: `owner_late_refund:${b.id}`,
        bookingId: b.id,
        to: owner,
        content: ownerLateRefund(ownerFacts(t, b)),
      });
    }
  });
}

// ---------------------------------------------------------------- scheduled

type Counts = Record<"sent" | "failed" | "duplicate" | "skipped", number>;

// Run by the booking app's job every 15 minutes (/api/jobs/emails):
// reminders before appointments, aftercare and review requests after jobs,
// and alerts about enquiries that didn't turn into bookings.
export async function runScheduledEmails(now = new Date()) {
  const counts: Counts = { sent: 0, failed: 0, duplicate: 0, skipped: 0 };
  const db = createAdminClient();
  const tenants = new Map<string, Promise<TenantContext | null>>();
  const tenantOf = (id: string) => {
    if (!tenants.has(id)) tenants.set(id, loadTenant(db, id));
    return tenants.get(id)!;
  };
  const tally = async (fn: () => Promise<"sent" | "failed" | "duplicate" | "skipped">) => {
    try {
      counts[await fn()]++;
    } catch (error) {
      counts.failed++;
      console.error("[email] scheduled message failed", error);
    }
  };
  const w = scheduledWindows(now);

  // What's already been sent for these bookings or leads, so the job doesn't
  // lean on the unique index for every row on every run.
  async function alreadySent(column: "booking_id" | "lead_id", ids: string[], kinds: EmailKind[]) {
    const done = new Set<string>();
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await db
        .from("email_log")
        .select(`kind, dedupe_key, ${column}`)
        .in(column, ids.slice(i, i + 200))
        .in("kind", kinds);
      if (error) throw error;
      for (const row of data as unknown as Record<string, string>[]) {
        done.add(`${row.kind}:${row[column]}`);
        done.add(row.dedupe_key);
      }
    }
    return done;
  }

  await quietly("reminders", async () => {
    const { data, error } = await db
      .from("bookings")
      .select(BOOKING_FIELDS)
      .eq("status", "confirmed")
      .gt("starts_at", now.toISOString())
      .lt("starts_at", w.remindersUntil.toISOString())
      .order("starts_at")
      .limit(1000);
    if (error) throw error;
    const rows = data as unknown as BookingRow[];
    const done = await alreadySent("booking_id", rows.map((r) => r.id), ["reminder"]);
    // A booking that's been moved, by anyone, is reminded again about its new time.
    const reminderKey = (id: string, movedAt: string | null) => (movedAt ? `reminder:${id}:${movedAt}` : `reminder:${id}`);
    for (const row of rows) {
      if (done.has(reminderKey(row.id, row.rescheduled_at))) continue;
      const t = await tenantOf(row.tenant_id);
      const b = toBooking(row);
      const reminder = t?.settings.messages.reminder;
      if (!t || !b || !reminder?.enabled || !reminderDue({ startsAt: b.startsAt, createdAt: b.rescheduledAt ?? b.createdAt }, reminder.hours_before, now)) continue;
      const to = customerAddress(t, b);
      if (!to) continue;
      const manage = await manageBookingUrl(t, b.id);
      const values = templateValues(t, b, manage ?? "");
      await tally(() =>
        send(db, t, {
          kind: "reminder",
          dedupeKey: reminderKey(row.id, row.rescheduled_at),
          bookingId: b.id,
          customerId: b.customer.id,
          to,
          content: templateMessage(
            "reminder",
            { subject: renderTemplate(reminder.subject, values), body: renderTemplate(reminder.body, values) },
            { facts: bookingFacts(t, b), buttonUrl: manage },
          ),
        }),
      );
    }
  });

  // Aftercare and review requests invite the customer back, so they're
  // marketing: only to customers who opted in, with an unsubscribe link.
  await quietly("after the job", async () => {
    const { data, error } = await db
      .from("bookings")
      .select(BOOKING_FIELDS)
      .eq("status", "completed")
      .gt("ends_at", w.jobsEndedAfter.toISOString())
      .lte("ends_at", now.toISOString())
      .order("ends_at")
      .limit(1000);
    if (error) throw error;
    const rows = data as unknown as BookingRow[];
    const done = await alreadySent("booking_id", rows.map((r) => r.id), ["follow_up", "review_request"]);
    for (const row of rows) {
      const t = await tenantOf(row.tenant_id);
      const b = toBooking(row);
      if (!t || !b || !b.customer.emailMarketing) continue;
      const to = customerAddress(t, b);
      if (!to) continue;
      const values = templateValues(t, b);
      const m = t.settings.messages;
      const due: ["follow_up" | "review_request", { subject: string; body: string }][] = [];
      if (m.follow_up.enabled && afterJobDue(b.endsAt, m.follow_up.days_after, now)) due.push(["follow_up", m.follow_up]);
      // Without a review link there's nothing to ask them to click.
      if (m.review_request.enabled && m.review_request.review_url && afterJobDue(b.endsAt, m.review_request.days_after, now)) {
        due.push(["review_request", m.review_request]);
      }
      for (const [kind, template] of due) {
        if (done.has(`${kind}:${b.id}`)) continue;
        await tally(() =>
          send(db, t, {
            kind,
            dedupeKey: `${kind}:${b.id}`,
            bookingId: b.id,
            customerId: b.customer.id,
            to,
            content: templateMessage(
              kind,
              { subject: renderTemplate(template.subject, values), body: renderTemplate(template.body, values) },
              { buttonUrl: kind === "review_request" ? m.review_request.review_url : t.siteUrl },
            ),
            marketing: { customerId: b.customer.id },
          }),
        );
      }
    }
  });

  // Someone got a price and didn't book. Inviting them back is marketing, so
  // only those who opted in, and only once.
  await quietly("quote follow-ups", async () => {
    const { data, error } = await db
      .from("leads")
      .select("id, tenant_id, created_at, quote_snapshot, customer:customers(id, name, email, email_marketing)")
      .eq("status", "quoted")
      .gt("created_at", new Date(now.getTime() - (30 + CATCH_UP_DAYS) * 86_400_000).toISOString())
      .limit(1000);
    if (error) throw error;
    const leads = data as unknown as {
      id: string;
      tenant_id: string;
      created_at: string;
      quote_snapshot: { service_name?: string } | null;
      customer: { id: string; name: string; email: string | null; email_marketing: boolean } | null;
    }[];
    if (!leads.length) return;
    const done = await alreadySent("lead_id", leads.map((l) => l.id), ["quote_follow_up"]);
    for (const lead of leads) {
      const c = lead.customer;
      if (done.has(`quote_follow_up:${lead.id}`) || !c?.email || !c.email_marketing) continue;
      const t = await tenantOf(lead.tenant_id);
      const template = t?.settings.messages.quote_follow_up;
      if (!t || !template?.enabled || !t.settings.channels.email) continue;
      if (!afterJobDue(new Date(lead.created_at), template.days_after, now)) continue;
      const values = { customer_name: firstName(c.name), business_name: t.name, service: lead.quote_snapshot?.service_name ?? "booking", booking_link: t.siteUrl };
      await tally(() =>
        send(db, t, {
          kind: "quote_follow_up",
          dedupeKey: `quote_follow_up:${lead.id}`,
          leadId: lead.id,
          customerId: c.id,
          to: c.email as string,
          content: templateMessage(
            "quote_follow_up",
            { subject: renderTemplate(template.subject, values), body: renderTemplate(template.body, values) },
            { buttonUrl: t.siteUrl },
          ),
          marketing: { customerId: c.id },
        }),
      );
    }
  });

  // A service is due again. Also marketing; skipped if they've booked since.
  await quietly("rebooking reminders", async () => {
    const { data: services, error } = await db.from("services").select("id, tenant_id, rebook_weeks").not("rebook_weeks", "is", null).limit(2000);
    if (error) throw error;
    for (const service of services as { id: string; tenant_id: string; rebook_weeks: number }[]) {
      const t = await tenantOf(service.tenant_id);
      const template = t?.settings.messages.rebook_reminder;
      if (!t || !template?.enabled || !t.settings.channels.email) continue;
      const due = now.getTime() - service.rebook_weeks * 7 * 86_400_000;
      const { data: rows, error: rowsError } = await db
        .from("bookings")
        .select(BOOKING_FIELDS)
        .eq("tenant_id", service.tenant_id)
        .eq("service_id", service.id)
        .eq("status", "completed")
        .gt("ends_at", new Date(due - CATCH_UP_DAYS * 86_400_000).toISOString())
        .lte("ends_at", new Date(due).toISOString())
        .limit(500);
      if (rowsError) throw rowsError;
      const list = rows as unknown as BookingRow[];
      if (!list.length) continue;
      const done = await alreadySent("booking_id", list.map((r) => r.id), ["rebook_reminder"]);
      for (const row of list) {
        const b = toBooking(row);
        if (!b || done.has(`rebook_reminder:${b.id}`) || !b.customer.email || !b.customer.emailMarketing) continue;
        const later = await db
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", service.tenant_id)
          .eq("customer_id", b.customer.id)
          .in("status", ["held", "requested", "confirmed", "completed"])
          .gt("starts_at", row.ends_at);
        if (later.error) throw later.error;
        if (later.count) continue;
        const values = templateValues(t, b);
        await tally(() =>
          send(db, t, {
            kind: "rebook_reminder",
            dedupeKey: `rebook_reminder:${b.id}`,
            bookingId: b.id,
            customerId: b.customer.id,
            to: b.customer.email as string,
            content: templateMessage(
              "rebook_reminder",
              { subject: renderTemplate(template.subject, values), body: renderTemplate(template.body, values) },
              { buttonUrl: t.siteUrl },
            ),
            marketing: { customerId: b.customer.id },
          }),
        );
      }
    }
  });

  await quietly("campaigns", async () => {
    const { data, error } = await db.from("campaigns").select("id").eq("status", "sending").limit(5);
    if (error) throw error;
    for (const campaign of data) await sendCampaignBatch(campaign.id);
  });

  await quietly("enquiry alerts", async () => {
    const { data, error } = await db
      .from("leads")
      .select("id, tenant_id, created_at, quote_snapshot, customer:customers(name, email, phone)")
      .in("status", ["new", "quoted"])
      .gt("created_at", w.leadsCreatedAfter.toISOString())
      .lte("created_at", w.leadsCreatedBefore.toISOString())
      .limit(500);
    if (error) throw error;
    const leads = data as unknown as {
      id: string;
      tenant_id: string;
      created_at: string;
      quote_snapshot: { service_name?: string; total_pence?: number } | null;
      customer: { name: string; email: string | null; phone: string | null } | null;
    }[];
    if (!leads.length) return;
    const ids = leads.map((l) => l.id);
    const done = await alreadySent("lead_id", ids, ["owner_new_lead"]);
    // A lead whose booking is held, waiting for approval or made doesn't need chasing.
    const booked = new Set<string>();
    for (let i = 0; i < ids.length; i += 200) {
      const live = await db
        .from("bookings")
        .select("lead_id")
        .in("lead_id", ids.slice(i, i + 200))
        .in("status", ["held", "requested", "confirmed", "completed"]);
      if (live.error) throw live.error;
      for (const row of live.data) if (row.lead_id) booked.add(row.lead_id);
    }

    for (const lead of leads) {
      if (done.has(`owner_new_lead:${lead.id}`) || booked.has(lead.id) || !lead.customer) continue;
      if (!leadAlertDue(new Date(lead.created_at), now)) continue;
      const t = await tenantOf(lead.tenant_id);
      if (!t || !t.settings.alerts.new_lead) continue;
      const owner = await t.alertEmail();
      if (!owner) continue;
      const snapshot = lead.quote_snapshot;
      await tally(() =>
        send(db, t, {
          kind: "owner_new_lead",
          dedupeKey: `owner_new_lead:${lead.id}`,
          leadId: lead.id,
          to: owner,
          content: ownerNewLead(
            {
              customerName: lead.customer!.name,
              customerEmail: lead.customer!.email,
              customerPhone: lead.customer!.phone,
              service: snapshot?.service_name ?? null,
              date: null,
              time: null,
              address: null,
              link: dashboardUrl(t.slug, `/leads/${lead.id}`),
            },
            { quotedPence: typeof snapshot?.total_pence === "number" ? snapshot.total_pence : null },
          ),
        }),
      );
    }
  });

  return counts;
}

// ---------------------------------------------------------------- campaigns

// A campaign's own subject as its heading, and a button to book.
function campaignMessage(campaign: { subject: string; body: string }, values: Partial<Record<TemplateField, string>>): Composed {
  const subject = renderTemplate(campaign.subject, values);
  return {
    subject,
    heading: subject,
    body: renderTemplate(campaign.body, values),
    ...(values.booking_link && { button: { label: "Book now", url: values.booking_link } }),
  };
}

const CAMPAIGN_BATCH = 150;
// Resend allows about two sends a second.
const CAMPAIGN_PAUSE_MS = 550;

// Sends the next batch of one campaign, to customers who opted in. Picks up
// where it left off, so it can run again and again until everyone's had it;
// the email log's dedupe key means nobody gets it twice. Never throws.
export async function sendCampaignBatch(campaignId: string) {
  await quietly("campaign", async () => {
    const db = createAdminClient();
    const { data: campaign, error } = await db
      .from("campaigns")
      .select("id, tenant_id, subject, body, status, last_customer_id, sent_count")
      .eq("id", campaignId)
      .maybeSingle();
    if (error) throw error;
    if (!campaign || campaign.status !== "sending") return;
    const t = await loadTenant(db, campaign.tenant_id);
    if (!t) return;

    let query = db
      .from("customers")
      .select("id, name, email")
      .eq("tenant_id", campaign.tenant_id)
      .eq("email_marketing", true)
      .is("anonymised_at", null)
      .not("email", "is", null)
      .order("id")
      .limit(CAMPAIGN_BATCH);
    if (campaign.last_customer_id) query = query.gt("id", campaign.last_customer_id);
    const { data: customers, error: customerError } = await query;
    if (customerError) throw customerError;

    let sent = 0;
    for (const c of customers) {
      const values = { customer_name: firstName(c.name), business_name: t.name, booking_link: t.siteUrl };
      const result = await send(db, t, {
        kind: "campaign",
        dedupeKey: `campaign:${campaign.id}:${c.id}`,
        customerId: c.id,
        to: c.email as string,
        content: campaignMessage(campaign, values),
        marketing: { customerId: c.id },
      });
      if (result === "sent") sent += 1;
      await new Promise((resolve) => setTimeout(resolve, CAMPAIGN_PAUSE_MS));
    }

    const done = customers.length < CAMPAIGN_BATCH;
    const saved = await db
      .from("campaigns")
      .update({
        sent_count: campaign.sent_count + sent,
        last_customer_id: customers.at(-1)?.id ?? campaign.last_customer_id,
        ...(done && { status: "sent", finished_at: new Date().toISOString() }),
      })
      .eq("id", campaign.id);
    if (saved.error) throw saved.error;
  });
}

// A campaign to the person writing it, reported back. Not marketing to a
// customer, so it carries no unsubscribe link; the real ones do.
export async function sendCampaignTest(tenantId: string, campaign: { id: string; subject: string; body: string }, to: string) {
  try {
    const db = createAdminClient();
    const t = await loadTenant(db, tenantId);
    if (!t) return { ok: false as const, message: "Couldn't load your business." };
    const values = { customer_name: "Sam", business_name: t.name, booking_link: t.siteUrl };
    const result = await send(db, t, {
      kind: "campaign",
      dedupeKey: `campaign_test:${campaign.id}:${Date.now()}`,
      to,
      content: { ...campaignMessage(campaign, values), subject: `[Test] ${renderTemplate(campaign.subject, values)}` },
    });
    return result === "sent" ? { ok: true as const } : { ok: false as const, message: "Couldn't send the test. Check your sending address under Settings → Notifications." };
  } catch (error) {
    console.error("[email] campaign test failed", error);
    return { ok: false as const, message: "Couldn't send the test. Try again." };
  }
}

// ---------------------------------------------------------------- payment links

// Someone at the business pressed "Email" on a payment link. Unlike the rest
// of this file it reports back, since they're waiting to hear it went, and
// each press sends again: asking twice is how a link gets resent.
export async function emailPaymentLink(
  tenantId: string,
  linkId: string,
  to: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const db = createAdminClient();
    const [t, link] = await Promise.all([
      loadTenant(db, tenantId),
      db
        .from("payment_links")
        .select("id, url, description, amount_pence, active, booking_id")
        .eq("tenant_id", tenantId)
        .eq("id", linkId)
        .maybeSingle(),
    ]);
    if (link.error) throw link.error;
    if (!t || !link.data) return { ok: false, message: "That link wasn't found." };
    if (!link.data.active) return { ok: false, message: "That link is switched off, so it can't be sent." };
    if (!t.senderAddress && process.env.RESEND_API_KEY) {
      return { ok: false, message: "Set up your email address under Settings → Notifications first, so it comes from you." };
    }

    const b = link.data.booking_id ? await loadBooking(db, tenantId, link.data.booking_id) : null;
    // The booking's customer, if that's who it's going to.
    const customer = b && b.customer.email?.toLowerCase() === to.toLowerCase() ? b.customer : null;
    const facts = b ? bookingFacts(t, b) : null;
    const prefix = `payment_link:${link.data.id}:${to.toLowerCase()}:`;
    if (await sentMomentsAgo(db, t.id, "payment_link", { dedupePrefix: prefix })) return { ok: true };
    const result = await send(db, t, {
      kind: "payment_link",
      dedupeKey: `${prefix}${resendWindow()}`.slice(0, 200),
      bookingId: b?.id,
      customerId: customer?.id,
      to,
      content: paymentRequest({
        customerName: customer?.name ?? null,
        businessName: t.name,
        description: link.data.description,
        amountPence: link.data.amount_pence,
        url: link.data.url,
        booking: facts && { service: facts.service, date: facts.date, time: facts.time },
      }),
    });
    if (result !== "sent") return { ok: false, message: "The email couldn't be sent. Try again in a minute." };

    const stamped = await db
      .from("payment_links")
      .update({ emailed_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("id", link.data.id);
    if (stamped.error) console.error("[email] couldn't record that a payment link was emailed", stamped.error);
    return { ok: true };
  } catch (error) {
    console.error("[email] emailing a payment link failed", error);
    return { ok: false, message: "The email couldn't be sent. Try again in a minute." };
  }
}

// A payment link was paid (checkout.session.completed on the business's
// account, from the webhook): thank the customer, with what's left on the
// booking if it's for one, and Stripe's receipt. Deposits aren't sent this:
// the booking confirmation covers them. Sent once per Checkout Session.
export async function notifyPaymentReceived(accountId: string, session: Stripe.Checkout.Session) {
  await quietly("payment received", async () => {
    if (!session.payment_link || session.payment_status !== "paid") return;
    const db = createAdminClient();
    const tenant = await db.from("tenants").select("id").eq("stripe_account_id", accountId).maybeSingle();
    if (tenant.error) throw tenant.error;
    if (!tenant.data) return;
    const tenantId = tenant.data.id;

    const linkId = typeof session.payment_link === "string" ? session.payment_link : session.payment_link.id;
    const [t, link] = await Promise.all([
      loadTenant(db, tenantId),
      db.from("payment_links").select("description, booking_id").eq("tenant_id", tenantId).eq("stripe_payment_link_id", linkId).maybeSingle(),
    ]);
    if (link.error) throw link.error;
    if (!t || !t.settings.channels.email) return;

    // The booking comes from our own record of the link, never the session's metadata alone.
    const b = link.data?.booking_id ? await loadBooking(db, tenantId, link.data.booking_id) : null;
    const to = session.customer_details?.email ?? b?.customer.email ?? null;
    if (!to) return;
    const customer = b && b.customer.email?.toLowerCase() === to.toLowerCase() ? b.customer : null;

    const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    const pi = paymentIntentId
      ? await getStripe().paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] }, { stripeAccount: accountId })
      : null;
    const charge = pi?.latest_charge && typeof pi.latest_charge !== "string" ? pi.latest_charge : null;

    let balancePence: number | null = null;
    if (b) {
      const payments = await loadBookingPayments(tenantId, b.id);
      // Stripe's lists can lag a moment behind the webhook; count this payment either way.
      const withThis =
        charge && !payments.some((p) => p.id === charge.id)
          ? [...payments, { status: "paid" as const, amountPence: charge.amount, refundedPence: charge.amount_refunded }]
          : payments;
      balancePence = paymentSummary(
        { price_pence: b.pricePence, deposit_pence: b.depositPence, deposit_status: b.depositStatus },
        withThis,
      ).balancePence;
    }

    const facts = b ? bookingFacts(t, b) : null;
    await send(db, t, {
      kind: "payment_received",
      dedupeKey: `payment_received:${session.id}`,
      bookingId: b?.id,
      customerId: customer?.id,
      to,
      content: paymentReceived({
        customerName: customer?.name ?? session.customer_details?.name ?? null,
        businessName: t.name,
        description: link.data?.description ?? null,
        amountPence: session.amount_total ?? charge?.amount ?? 0,
        receiptUrl: charge?.receipt_url ?? null,
        booking: facts && { service: facts.service, date: facts.date, time: facts.time },
        balancePence,
      }),
    });
  });
}
