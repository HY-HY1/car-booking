import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Camera, Mail, MapPin, Phone } from "lucide-react";
import { z } from "zod";
import { answersOf } from "@leadgen/core/booking/answers";
import { formatDuration, formatPence } from "@leadgen/core/booking/config";
import { loadBookingPayments } from "@leadgen/core/stripe/ledger";
import { policyOf, refundAdvice } from "@leadgen/core/settings/policy";
import { PAYABLE_BOOKING_STATUSES, paymentSummary } from "@leadgen/core/stripe/payment-rules";
import { ApprovalActions } from "@/components/dashboard/approval-actions";
import { BookingPaymentActions } from "@/components/dashboard/booking-payment-actions";
import { BackLink } from "@/components/dashboard/page-header";
import { DeactivateLink } from "@/components/dashboard/payment-link-form";
import { RefundDeposit } from "@/components/dashboard/refund-deposit";
import { CopyText } from "@/components/platform/copy-text";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  accessRowsOf,
  BOOKING_SOURCE,
  BOOKING_STATUS,
  BOOKING_STATUS_TONE,
  DEPOSIT_STATUS,
  quoteOf,
  SIZE_NAME,
  submittedGroups,
} from "@/lib/booking-display";
import { SubmittedAnswers } from "@/components/dashboard/submitted-answers";
import { requireTenant } from "@/lib/auth";
import { ConditionNote } from "@/components/dashboard/condition-note";
import { PAYMENT_SOURCE, PAYMENT_STATUS } from "@/lib/payment-labels";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { appUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Booking" };

type BookingRow = {
  id: string;
  resource_id: string;
  starts_at: string;
  ends_at: string;
  created_at: string;
  updated_at: string;
  status: string;
  decline_reason: string | null;
  location_type: "mobile" | "unit";
  address_line: string | null;
  postcode: string;
  access_notes: Record<string, unknown> | null;
  customer_notes: string | null;
  quote_snapshot: unknown;
  source: string;
  price_pence: number;
  deposit_pence: number;
  deposit_status: string;
  stripe_payment_intent_id: string | null;
  customer: { id: string; name: string; email: string | null; phone: string | null; email_marketing: boolean } | null;
  service: { name: string; description: string | null } | null;
  vehicle: { make: string | null; model: string | null; registration: string | null; size_class: string | null } | null;
  photos: { count: number }[];
  lead: { status: string } | null;
};

export default async function BookingPage({ params }: PageProps<"/app/[tenant]/bookings/[id]">) {
  const { tenant: slug, id } = await params;
  const { tenant, can } = await requireTenant(slug);
  if (!z.uuid().safeParse(id).success) notFound();
  // Payment links and refunds are money (owners and managers).
  const isOwner = can("money");

  // RLS limits every read to this business.
  const supabase = await createClient();
  const [booking, links, tenantRow, vans, policyRow] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "id, starts_at, ends_at, created_at, updated_at, status, decline_reason, resource_id, location_type, address_line, postcode, access_notes, customer_notes, quote_snapshot, source, price_pence, deposit_pence, deposit_status, stripe_payment_intent_id, customer:customers(id, name, email, phone, email_marketing), service:services(name, description), vehicle:vehicles(make, model, registration, size_class), photos(count), lead:leads(status)",
      )
      .eq("tenant_id", tenant.id)
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("payment_links")
      .select("id, url, description, amount_pence, single_use")
      .eq("tenant_id", tenant.id)
      .eq("booking_id", id)
      .eq("active", true)
      .order("created_at", { ascending: false }),
    supabase.from("tenants").select("stripe_ready").eq("id", tenant.id).single(),
    supabase.from("resources").select("id, name").eq("tenant_id", tenant.id),
    supabase.from("booking_settings").select("cancellation_policy").eq("tenant_id", tenant.id).maybeSingle(),
  ]);
  if (booking.error) throw booking.error;
  if (links.error) throw links.error;
  if (tenantRow.error) throw tenantRow.error;
  if (vans.error) throw vans.error;
  if (!booking.data) notFound();
  const b = booking.data as unknown as BookingRow;
  // Which van or bay has it, worth saying only when there's a choice.
  const van = vans.data.length > 1 ? vans.data.find((v) => v.id === b.resource_id)?.name : undefined;

  // Everything paid on this booking: the ledger, brought up to date from
  // Stripe first. The booking's own deposit record is the floor under it.
  const payments = await loadBookingPayments(tenant.id, b.id);
  const summary = paymentSummary(b, payments);

  const quote = quoteOf(b.quote_snapshot);
  const accessRows = accessRowsOf(b.access_notes);
  const submitted = submittedGroups({
    answers: answersOf(b.quote_snapshot),
    vehicle: b.vehicle,
    access: b.access_notes,
    notes: b.customer_notes,
    postcode: b.postcode,
    addressLine: b.address_line,
    locationType: b.location_type,
    marketing: b.customer?.email_marketing,
  });
  const car = [b.vehicle?.make, b.vehicle?.model].filter(Boolean).join(" ");
  const photos = b.photos[0]?.count ?? 0;
  const minutes = Math.round((new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime()) / 60_000);

  const payable = (PAYABLE_BOOKING_STATUSES as readonly string[]).includes(b.status);
  const showPaymentActions = isOwner && payable && !summary.fullyPaid;
  const canRefund = isOwner && b.deposit_status === "paid" && !!b.stripe_payment_intent_id;
  // What the cancellation policy says to give back: a cancellation counts
  // from when it was cancelled (the row's last change), a no-show as late.
  const advice =
    b.status === "cancelled" || b.status === "no_show"
      ? refundAdvice(
          policyOf(policyRow.data?.cancellation_policy),
          { startsAt: b.starts_at, depositPaidPence: b.deposit_pence },
          new Date(b.status === "no_show" ? b.starts_at : b.updated_at),
        )
      : null;

  return (
    <>
      <BackLink href={appUrl(`/${slug}/bookings`)}>Bookings</BackLink>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{b.service?.name ?? "Booking"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDay(b.starts_at)}, {formatTime(b.starts_at)} to {formatTime(b.ends_at)}
            {b.customer && <> · {b.customer.name}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-medium">
          <span className={cn("rounded-full px-2.5 py-1", BOOKING_STATUS_TONE[b.status] ?? "bg-muted")}>
            {BOOKING_STATUS[b.status] ?? b.status}
          </span>
          <span
            className={cn(
              "rounded-full px-2.5 py-1",
              summary.fullyPaid ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-100" : "bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-100",
            )}
          >
            {summary.fullyPaid ? "Paid in full" : `${formatPence(summary.balancePence)} to pay`}
          </span>
        </div>
      </header>

      {b.status === "requested" && can("bookings.manage") && (
        <div className="mb-6 grid gap-3 rounded-xl border border-violet-300 bg-violet-50 p-4 text-violet-950 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100">
          <p className="text-sm">
            This booking is waiting for your approval. The time is kept for it until you approve or decline it.
          </p>
          <ApprovalActions
            slug={slug}
            bookingId={b.id}
            customer={b.customer?.name ?? "this customer"}
            depositPaid={b.deposit_status === "paid"}
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid content-start gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Job</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Rows>
                <Row label="Date">{formatDay(b.starts_at)}</Row>
                <Row label="Time">
                  {formatTime(b.starts_at)} to {formatTime(b.ends_at)}
                  <span className="text-muted-foreground"> · {formatDuration(minutes)}</span>
                </Row>
                {van && <Row label="Van or bay">{van}</Row>}
                <Row label="Service">
                  {b.service?.name ?? "—"}
                  {b.service?.description && <span className="block text-muted-foreground">{b.service.description}</span>}
                </Row>
              </Rows>
              {quote && quote.lines.length > 0 && (
                <ul className="grid gap-1.5 border-t pt-3">
                  {quote.lines.map((l, i) => (
                    <li key={i} className="flex justify-between gap-4">
                      <span className="text-muted-foreground">{l.label}</span>
                      <span>{formatPence(l.amount_pence)}</span>
                    </li>
                  ))}
                  <li className="mt-1 flex justify-between gap-4 border-t pt-2 font-medium">
                    <span>Total</span>
                    <span>{formatPence(b.price_pence)}</span>
                  </li>
                </ul>
              )}
              {quote && <ConditionNote condition={quote.condition} needsInspection={quote.needsInspection} />}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="size-4 text-muted-foreground" />
                  Location
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {b.location_type === "unit" ? (
                  <p>Drop-off at your unit</p>
                ) : (
                  <p>{[b.address_line, b.postcode].filter(Boolean).join(", ")}</p>
                )}
                {accessRows.length > 0 && (
                  <Rows>
                    {accessRows.map(([label, value]) => (
                      <Row key={label} label={label}>
                        {value}
                      </Row>
                    ))}
                  </Rows>
                )}
                {b.location_type === "mobile" && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([b.address_line, b.postcode].filter(Boolean).join(", "))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-fit text-muted-foreground underline underline-offset-4 hover:text-foreground"
                  >
                    Open in Maps
                  </a>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Vehicle</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {car || b.vehicle?.registration ? (
                  <Rows>
                    <Row label="Car">{car || "—"}</Row>
                    {b.vehicle?.registration && (
                      <Row label="Reg">
                        <span className="font-mono">{b.vehicle.registration}</span>
                      </Row>
                    )}
                    {b.vehicle?.size_class && (
                      <Row label="Size">{SIZE_NAME[b.vehicle.size_class] ?? b.vehicle.size_class}</Row>
                    )}
                  </Rows>
                ) : (
                  <p className="text-muted-foreground">Not recorded.</p>
                )}
                {b.customer && photos > 0 && (
                  <Link
                    href={appUrl(`/${slug}/customers/${b.customer.id}#photos`)}
                    className="flex w-fit items-center gap-1.5 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    <Camera className="size-4" />
                    {photos} {photos === 1 ? "photo" : "photos"} from the customer
                  </Link>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Everything they submitted</CardTitle>
            </CardHeader>
            <CardContent>
              <SubmittedAnswers groups={submitted} />
            </CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {b.customer ? (
                <>
                  <Link
                    href={appUrl(`/${slug}/customers/${b.customer.id}`)}
                    className="w-fit font-medium underline-offset-4 hover:underline"
                  >
                    {b.customer.name}
                  </Link>
                  {b.customer.phone && (
                    <a href={`tel:${b.customer.phone}`} className="flex items-center gap-2 hover:underline">
                      <Phone className="size-4 text-muted-foreground" />
                      {b.customer.phone}
                    </a>
                  )}
                  {b.customer.email && (
                    <a href={`mailto:${b.customer.email}`} className="flex items-center gap-2 break-all hover:underline">
                      <Mail className="size-4 shrink-0 text-muted-foreground" />
                      {b.customer.email}
                    </a>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">No customer on this booking.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Rows>
                <Row label="Price">{formatPence(b.price_pence)}</Row>
                <Row label="Deposit">
                  {DEPOSIT_STATUS[b.deposit_status] ?? b.deposit_status}
                  {b.deposit_pence > 0 && ` · ${formatPence(b.deposit_pence)}`}
                </Row>
                <Row label="Paid">{formatPence(summary.paidPence)}</Row>
                <Row label="To pay">
                  <span className="font-medium">{summary.fullyPaid ? "Nothing" : formatPence(summary.balancePence)}</span>
                </Row>
              </Rows>

              {payments.length > 0 ? (
                <ul className="grid gap-2 border-t pt-3">
                  {payments.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <span>
                        {formatPence(p.amountPence)}
                        <span className="block text-xs text-muted-foreground">
                          {PAYMENT_SOURCE[p.source]} · {formatShort(p.createdAt)}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", PAYMENT_STATUS[p.status].tone)}>
                          {PAYMENT_STATUS[p.status].label}
                        </span>
                        {p.receiptUrl && (
                          <a
                            href={p.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                          >
                            Receipt
                          </a>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="border-t pt-3 text-xs text-muted-foreground">No payments recorded for this booking yet.</p>
              )}

              {showPaymentActions && (
                <div className="border-t pt-3">
                  <BookingPaymentActions
                    slug={slug}
                    bookingId={b.id}
                    balancePence={summary.balancePence}
                    customerEmail={b.customer?.email ?? null}
                    blockedReason={
                      tenantRow.data.stripe_ready ? undefined : "Connect Stripe under Settings → Payments to create payment links."
                    }
                  />
                </div>
              )}

              {isOwner && links.data.length > 0 && (
                <div className="grid gap-3 border-t pt-3">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Active payment links</p>
                  {links.data.map((l) => (
                    <div key={l.id} className="grid gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span>
                          {l.description}: {formatPence(l.amount_pence)}
                        </span>
                        <DeactivateLink slug={slug} id={l.id} />
                      </div>
                      <CopyText value={l.url} label="payment link" />
                    </div>
                  ))}
                </div>
              )}

              {canRefund && (
                <div className="border-t pt-3">
                  <RefundDeposit slug={slug} bookingId={b.id} depositPence={b.deposit_pence} advice={advice} />
                </div>
              )}
              {b.deposit_status === "disputed" && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  The customer disputed the deposit with their bank. Answer it in your Stripe Dashboard, where you can
                  upload evidence.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Booking info</CardTitle>
            </CardHeader>
            <CardContent>
              <Rows>
                <Row label="Reference">
                  <span className="font-mono">{b.id.slice(0, 8).toUpperCase()}</span>
                </Row>
                <Row label="Booked">{formatShort(b.created_at)}</Row>
                <Row label="Source">{BOOKING_SOURCE[b.source] ?? b.source}</Row>
                {b.lead && <Row label="Enquiry">{b.lead.status === "booked" ? "Converted to booking" : b.lead.status}</Row>}
                {b.decline_reason && <Row label="Declined because">{b.decline_reason}</Row>}
              </Rows>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Rows({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-[6rem_1fr] gap-x-4 gap-y-2">{children}</dl>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  );
}

function formatDay(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date(iso));
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", timeZone: "Europe/London" }).format(
    new Date(iso),
  );
}

function formatShort(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(new Date(iso));
}
