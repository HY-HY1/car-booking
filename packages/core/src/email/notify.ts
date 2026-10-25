import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signUnsubscribeToken } from "../privacy/rules";
import { notificationsOf, renderTemplate, type NotificationSettings, type TemplateField } from "../settings/notifications";
import { createAdminClient } from "../supabase/admin";
import { isCustomHostname } from "../tenants";
import { adminUrl, appUrl, tenantUrl } from "../urls";
import type { StripeAlert } from "../stripe/alerts";
import {
  cancelled,
  declined,
  firstName,
  formatClock,
  formatDay,
  fromHeader,
  lateRefund,
  ownerCancellation,
  ownerDispute,
  ownerLateRefund,
  ownerNewBooking,
  ownerNewLead,
  ownerPaymentProblem,
  renderEmail,
  requestReceived,
  type BookingFacts,
  type Composed,
  type OwnerFacts,
} from "./compose";
import { afterJobDue, leadAlertDue, reminderDue, scheduledWindows } from "./schedule";
import { deliver, fromAddress } from "./transport";

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
  | "owner_new_booking"
  | "owner_cancellation"
  | "owner_new_lead"
  | "owner_dispute"
  | "owner_late_refund"
  | "owner_payment_problem";

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
  accentColor: string | undefined;
  settings: NotificationSettings;
  timezone: string;
  // Its verified custom domain, if any: where its booking pages live in subdomain mode.
  customDomain: string | null;
  // The booking page (tenantUrl), e.g. https://shine.domain.com
  siteUrl: string;
  // Where alerts go: the address in Settings → Notifications, else the owner's login.
  alertEmail: () => Promise<string | null>;
};

async function loadTenant(db: Db, tenantId: string): Promise<TenantContext | null> {
  const [tenant, settings, domain] = await Promise.all([
    db
      .from("tenants")
      .select("id, name, slug, contact_email, branding, notification_settings")
      .eq("id", tenantId)
      .maybeSingle(),
    db.from("booking_settings").select("timezone").eq("tenant_id", tenantId).maybeSingle(),
    db.from("domains").select("hostname, verified, is_primary").eq("tenant_id", tenantId),
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
    accentColor: (t.branding as { primary_color?: string } | null)?.primary_color,
    settings: notifications,
    timezone: settings.data?.timezone ?? DEFAULT_TIMEZONE,
    customDomain,
    siteUrl: tenantUrl(t.slug, "/", { absolute: true, customDomain }),
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
  service: string;
  customer: { id: string; name: string; email: string | null; phone: string | null; emailMarketing: boolean };
};

const BOOKING_FIELDS =
  "id, tenant_id, status, starts_at, ends_at, created_at, address_line, postcode, price_pence, deposit_pence, deposit_status, decline_reason, customer:customers(id, name, email, phone, email_marketing), service:services(name)";

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
    address: b.address,
    bookingLink: t.siteUrl,
  };
}

function templateValues(t: TenantContext, b: BookingContext): Record<TemplateField, string> {
  const f = bookingFacts(t, b);
  return {
    customer_name: firstName(f.customerName),
    business_name: f.businessName,
    service: f.service,
    date: f.date,
    time: f.time,
    address: f.address,
    booking_link: f.bookingLink,
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
async function send(db: Db, t: TenantContext, m: Message): Promise<"sent" | "failed" | "duplicate" | "skipped"> {
  const audience = m.kind.startsWith("owner_") ? "owner" : "customer";
  let unsubscribeUrl: string | undefined;
  if (m.marketing) {
    // Marketing has to carry a working opt-out; without one it isn't sent.
    const secret = process.env.PRIVACY_TOKEN_SECRET;
    if (!secret) return "skipped";
    const token = await signUnsubscribeToken(secret, m.marketing.customerId, "email");
    unsubscribeUrl = tenantUrl(t.slug, `/unsubscribe?t=${token}`, { absolute: true, customDomain: t.customDomain });
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
      ? [
          `${t.name}${t.contactEmail ? ` · ${t.contactEmail}` : ""}`,
          m.marketing
            ? `You're getting this because you booked with ${t.name} and said they could email you.`
            : `You're getting this because you made a booking with ${t.name}.`,
        ]
      : [`Alerts for ${t.name}. Change which ones you get: ${dashboardUrl(t.slug, "/settings/notifications")}`];
  const { text, html } = renderEmail({
    heading: audience === "customer" ? t.name : m.content.subject,
    body: m.content.body,
    footer,
    accentColor: t.accentColor,
    unsubscribeUrl,
  });
  const result = await deliver({
    from: fromHeader(t.settings.sender_name ?? t.name, fromAddress()),
    to: m.to,
    replyTo: audience === "customer" ? (t.settings.reply_to ?? t.contactEmail) : null,
    subject: m.content.subject,
    text,
    html,
    headers: unsubscribeUrl ? { "List-Unsubscribe": `<${unsubscribeUrl}>` } : undefined,
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
      const values = templateValues(t, b);
      await send(db, t, {
        kind: requested ? "request_received" : "confirmation",
        dedupeKey: `${requested ? "request_received" : "confirmation"}:${b.id}`,
        bookingId: b.id,
        customerId: b.customer.id,
        to,
        content: requested
          ? requestReceived(bookingFacts(t, b))
          : { subject: renderTemplate(confirmation.subject, values), body: renderTemplate(confirmation.body, values) },
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
export async function notifyBookingCancelled(tenantId: string, bookingId: string, opts: { by: string | null }) {
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
        content: cancelled(bookingFacts(t, b), { depositPaid: b.depositStatus === "paid" }),
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
        const { text, html } = renderEmail({ heading: content.subject, body: `${content.body}\n\nBusiness: ${t?.slug ?? "none matched"}`, footer: ["Platform alert"] });
        const result = await deliver({
          from: fromHeader("Platform alerts", fromAddress()),
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
        .select(`kind, ${column}`)
        .in(column, ids.slice(i, i + 200))
        .in("kind", kinds);
      if (error) throw error;
      for (const row of data as unknown as Record<string, string>[]) done.add(`${row.kind}:${row[column]}`);
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
    for (const row of rows) {
      if (done.has(`reminder:${row.id}`)) continue;
      const t = await tenantOf(row.tenant_id);
      const b = toBooking(row);
      const reminder = t?.settings.messages.reminder;
      if (!t || !b || !reminder?.enabled || !reminderDue(b, reminder.hours_before, now)) continue;
      const to = customerAddress(t, b);
      if (!to) continue;
      const values = templateValues(t, b);
      await tally(() =>
        send(db, t, {
          kind: "reminder",
          dedupeKey: `reminder:${b.id}`,
          bookingId: b.id,
          customerId: b.customer.id,
          to,
          content: { subject: renderTemplate(reminder.subject, values), body: renderTemplate(reminder.body, values) },
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
            content: { subject: renderTemplate(template.subject, values), body: renderTemplate(template.body, values) },
            marketing: { customerId: b.customer.id },
          }),
        );
      }
    }
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
