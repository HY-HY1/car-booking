import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, MapPin, Phone } from "lucide-react";
import { z } from "zod";
import { answersOf } from "@leadgen/core/booking/answers";
import { formatDuration, formatPence } from "@leadgen/core/booking/config";
import { bookingReference } from "@leadgen/core/booking/confirmation";
import { canEditBooking } from "@leadgen/core/booking/edit-rules";
import { depositOwed } from "@leadgen/core/booking/manage-rules";
import { flexibleJobs } from "@leadgen/core/booking/waitlist";
import { loadBookingPayments } from "@leadgen/core/stripe/ledger";
import { policyOf, refundAdvice } from "@leadgen/core/settings/policy";
import { isOffline, PAYABLE_BOOKING_STATUSES, paymentSummary, takesOfflinePayment } from "@leadgen/core/stripe/payment-rules";
import { ApprovalActions } from "@/components/dashboard/approval-actions";
import { BookingPaymentActions } from "@/components/dashboard/booking-payment-actions";
import { RecordPayment, RemovePayment } from "@/components/dashboard/offline-payment";
import { DepositRequestButton } from "@/components/dashboard/deposit-request-button";
import { CancelRepeats, InternalNotes, RefundPayment } from "@/components/dashboard/booking-extras";
import { JobPhotos } from "@/components/dashboard/job-photos";
import { PhotoThumbs } from "@/components/dashboard/photo-thumbs";
import { JobActions } from "@/components/dashboard/diary/job-actions";
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
import { listJobPhotos } from "@/lib/photos";
import { ConditionNote } from "@/components/dashboard/condition-note";
import { PAYMENT_SOURCE, PAYMENT_STATUS } from "@/lib/payment-labels";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/urls";
import { setBookingStatusAction } from "../../diary/actions";
import { cancelRepeatsAction, refundPaymentAction, saveInternalNotesAction, uploadJobPhotosAction } from "./actions";
import { formatDateTime, formatFullDate, formatTime } from "@leadgen/core/dates";
import { Badge } from "@/components/ui/badge";

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
  cancelled_at: string | null;
  cancelled_by: "business" | "customer" | null;
  rescheduled_at: string | null;
  rescheduled_from: string | null;
  reschedule_count: number;
  location_type: "mobile" | "unit";
  address_line: string | null;
  postcode: string;
  access_notes: Record<string, unknown> | null;
  customer_notes: string | null;
  internal_notes: string | null;
  cancel_reason: string | null;
  series_id: string | null;
  staff: { name: string } | null;
  quote_snapshot: unknown;
  source: string;
  price_pence: number;
  deposit_pence: number;
  deposit_status: string;
  stripe_payment_intent_id: string | null;
  customer: { id: string; name: string; email: string | null; phone: string | null; email_marketing: boolean } | null;
  service: { name: string; description: string | null } | null;
  vehicle: { make: string | null; model: string | null; registration: string | null; size_class: string | null } | null;
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
        "id, starts_at, ends_at, created_at, updated_at, status, decline_reason, cancelled_at, cancelled_by, rescheduled_at, rescheduled_from, reschedule_count, resource_id, location_type, address_line, postcode, access_notes, customer_notes, internal_notes, cancel_reason, series_id, staff:staff(name), quote_snapshot, source, price_pence, deposit_pence, deposit_status, stripe_payment_intent_id, customer:customers(id, name, email, phone, email_marketing), service:services(name, description), vehicle:vehicles(make, model, registration, size_class), lead:leads(status)",
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

  const canManage = can("bookings.manage");
  const now = new Date();
  const startsAhead = new Date(b.starts_at) > now;
  const editable = canManage && canEditBooking(b.status);
  const [extraCars, repeats, flexible] = await Promise.all([
    supabase.from("booking_vehicles").select("id, make, model, registration, price_pence").eq("tenant_id", tenant.id).eq("booking_id", b.id).order("created_at"),
    b.series_id
      ? supabase.from("bookings").select("id, starts_at, status").eq("tenant_id", tenant.id).eq("series_id", b.series_id).order("starts_at")
      : null,
    // Freed up and still ahead: who might like this time instead.
    b.status === "cancelled" && startsAhead && canManage
      ? flexibleJobs(tenant.id, { startsAt: b.starts_at, endsAt: b.ends_at, locationType: b.location_type })
      : [],
  ]);
  if (extraCars.error) throw extraCars.error;
  if (repeats?.error) throw repeats.error;
  const repeatsAhead = (repeats?.data ?? []).filter((r) => r.status === "confirmed" && new Date(r.starts_at) > now);
  // Which van or bay has it, worth saying only when there's a choice.
  const van = vans.data.length > 1 ? vans.data.find((v) => v.id === b.resource_id)?.name : undefined;

  // Everything paid on this booking: the ledger, brought up to date from
  // Stripe first. The booking's own deposit record is the floor under it.
  const payments = await loadBookingPayments(tenant.id, b.id);
  const summary = paymentSummary(b, payments);

  const quote = quoteOf(b.quote_snapshot);
  const accessRows = accessRowsOf(b.access_notes);
  // Everything on the form, less what the cards above already show.
  const onCards = new Set(["Car", "Registration", "Size", "Address", ...accessRows.map(([label]) => label)]);
  const submitted = submittedGroups({
    answers: answersOf(b.quote_snapshot),
    vehicle: b.vehicle,
    access: b.access_notes,
    notes: b.customer_notes,
    postcode: b.postcode,
    addressLine: b.address_line,
    locationType: b.location_type,
    marketing: b.customer?.email_marketing,
  })
    .map((g) => ({ ...g, rows: g.rows.filter(([label]) => !onCards.has(label)) }))
    .filter((g) => g.rows.length > 0);
  const car = [b.vehicle?.make, b.vehicle?.model].filter(Boolean).join(" ");
  // Extra: the page still opens if the photos can't be read.
  const allPhotos = b.customer
    ? await listJobPhotos(tenant.id, b.id, b.customer.id).catch((err) => {
        console.error("Booking photos read failed", err);
        return [];
      })
    : [];
  const photos = allPhotos.filter((p) => p.stage === "customer");
  const beforePhotos = allPhotos.filter((p) => p.stage === "before");
  const afterPhotos = allPhotos.filter((p) => p.stage === "after");
  const minutes = Math.round((new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime()) / 60_000);

  const payable = (PAYABLE_BOOKING_STATUSES as readonly string[]).includes(b.status);
  const showPaymentActions = isOwner && payable && !summary.fullyPaid;
  const canRefund = isOwner && b.deposit_status === "paid" && !!b.stripe_payment_intent_id;
  // What the cancellation policy says to give back: a cancellation counts
  // from when it was cancelled, a no-show as late.
  const advice =
    b.status === "cancelled" || b.status === "no_show"
      ? refundAdvice(
          policyOf(policyRow.data?.cancellation_policy),
          { startsAt: b.starts_at, depositPaidPence: b.deposit_pence },
          new Date(b.status === "no_show" ? b.starts_at : (b.cancelled_at ?? b.updated_at)),
        )
      : null;
  // The same deposit, offered back while cancelling.
  const policy = policyOf(policyRow.data?.cancellation_policy);
  const refundOffer = canRefund
    ? { depositPence: b.deposit_pence, advice: refundAdvice(policy, { startsAt: b.starts_at, depositPaidPence: b.deposit_pence }) }
    : undefined;

  return (
    <>
      <BackLink href={appUrl(`/${slug}/bookings`)}>Bookings</BackLink>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{b.service?.name ?? "Booking"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatFullDate(b.starts_at)}, {formatTime(b.starts_at)} to {formatTime(b.ends_at)} · {formatDuration(minutes)}
            {van && <> · {van}</>}
            {b.staff && <> · {b.staff.name}</>}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {editable && (
              <Link href={appUrl(`/${slug}/bookings/${b.id}/edit`)} className="underline underline-offset-4">
                Change booking
              </Link>
            )}
            {editable && (
              <Link href={appUrl(`/${slug}/diary?view=day&date=${b.starts_at.slice(0, 10)}&job=${b.id}`)} className="underline underline-offset-4">
                Change the time
              </Link>
            )}
            {isOwner && payable && (
              <a href={appUrl(`/${slug}/bookings/${b.id}/invoice`)} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                Invoice
              </a>
            )}
          </div>
          {b.service?.description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{b.service.description}</p>}
        </div>
        <Badge tone={BOOKING_STATUS_TONE[b.status]}>{BOOKING_STATUS[b.status] ?? b.status}</Badge>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid content-start gap-4 lg:col-span-2">
          <div className="grid gap-4 md:grid-cols-2">
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

          </div>

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
              {quote && <ConditionNote condition={quote.condition} needsInspection={quote.needsInspection} />}
              {extraCars.data.length > 0 && (
                <div className="grid gap-1 border-t pt-3">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Also on this booking</p>
                  {extraCars.data.map((c) => (
                    <p key={c.id}>
                      {[c.make, c.model].filter(Boolean).join(" ") || "Car"}
                      {c.registration && <span className="ml-2 font-mono">{c.registration}</span>}
                    </p>
                  ))}
                </div>
              )}
              {photos.length > 0 && <PhotoThumbs photos={photos} className="sm:grid-cols-4" />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Team notes</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <p className="text-xs text-muted-foreground">Only your team sees these. They&apos;re never sent to the customer.</p>
              <InternalNotes initial={b.internal_notes ?? ""} save={saveInternalNotesAction.bind(null, slug, b.id)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Job photos</CardTitle>
            </CardHeader>
            <CardContent>
              <JobPhotos before={beforePhotos} after={afterPhotos} upload={uploadJobPhotosAction.bind(null, slug, b.id)} canAdd={!!b.customer} />
            </CardContent>
          </Card>

          {repeats && repeats.data.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Repeat booking</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <ul className="grid gap-1">
                  {repeats.data.map((r) => (
                    <li key={r.id} className="flex justify-between gap-3">
                      {r.id === b.id ? (
                        <span className="font-medium">{formatFullDate(r.starts_at)}</span>
                      ) : (
                        <Link href={appUrl(`/${slug}/bookings/${r.id}`)} className="underline-offset-4 hover:underline">
                          {formatFullDate(r.starts_at)}
                        </Link>
                      )}
                      <span className="text-muted-foreground">{BOOKING_STATUS[r.status] ?? r.status}</span>
                    </li>
                  ))}
                </ul>
                {canManage && repeatsAhead.length > 0 && b.series_id && (
                  <div>
                    <CancelRepeats count={repeatsAhead.length} action={cancelRepeatsAction.bind(null, slug, b.id, b.series_id)} />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {flexible.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Who might take this time</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                <p className="text-xs text-muted-foreground">Later bookings where the customer said they&apos;d like an earlier time, and the job would fit.</p>
                <ul className="grid gap-1">
                  {flexible.map((j) => (
                    <li key={j.id}>
                      <Link href={appUrl(`/${slug}/bookings/${j.id}`)} className="underline-offset-4 hover:underline">
                        {j.customerName ?? "Customer"}
                      </Link>
                      <span className="text-muted-foreground"> · {formatDateTime(j.startsAt)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {submitted.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Other details</CardTitle>
              </CardHeader>
              <CardContent>
                <SubmittedAnswers groups={submitted} />
              </CardContent>
            </Card>
          )}
        </div>

        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {quote && quote.lines.length > 0 && (
                <ul className="grid gap-1.5 border-b pb-3">
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
              <Rows>
                {!(quote && quote.lines.length > 0) && <Row label="Price">{formatPence(b.price_pence)}</Row>}
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
                          {PAYMENT_SOURCE[p.source]} · {formatDateTime(p.createdAt)}
                          {p.note && <> · {p.note}</>}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        {isOffline(p.source) && isOwner && <RemovePayment slug={slug} bookingId={b.id} paymentId={p.id} />}
                        {isOwner && !isOffline(p.source) && p.source !== "deposit" && p.status !== "failed" && p.amountPence > p.refundedPence && (
                          <RefundPayment remainingPence={p.amountPence - p.refundedPence} action={refundPaymentAction.bind(null, slug, b.id, p.id)} />
                        )}
                        <Badge tone={PAYMENT_STATUS[p.status].tone}>{PAYMENT_STATUS[p.status].label}</Badge>
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

              {isOwner && takesOfflinePayment(b.status) && (
                <div className="border-t pt-3">
                  <RecordPayment slug={slug} bookingId={b.id} balancePence={summary.balancePence} />
                </div>
              )}

              {can("bookings.manage") &&
                depositOwed({ status: b.status, depositPence: b.deposit_pence, depositStatus: b.deposit_status }) && (
                  <div className="border-t pt-3">
                    <DepositRequestButton
                      slug={slug}
                      bookingId={b.id}
                      depositPence={b.deposit_pence}
                      customerEmail={b.customer?.email ?? null}
                      blockedReason={
                        tenantRow.data.stripe_ready ? undefined : "Connect Stripe under Settings → Payments to take deposits online."
                      }
                    />
                  </div>
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
                  <span className="font-mono">{bookingReference(b.id)}</span>
                </Row>
                <Row label="Booked">{formatDateTime(b.created_at)}</Row>
                <Row label="How it was booked">{BOOKING_SOURCE[b.source] ?? b.source}</Row>
                {b.lead && <Row label="Enquiry">{b.lead.status === "booked" ? "Converted to booking" : b.lead.status}</Row>}
                {b.status === "cancelled" && b.cancelled_at && (
                  <Row label="Cancelled">
                    {formatDateTime(b.cancelled_at)}
                    {b.cancelled_by === "customer" && <span className="block text-muted-foreground">by the customer, online</span>}
                  </Row>
                )}
                {b.decline_reason && <Row label="Declined because">{b.decline_reason}</Row>}
                {b.cancel_reason && <Row label="Cancelled because">{b.cancel_reason}</Row>}
                {b.rescheduled_at && b.rescheduled_from && (
                  <Row label="Moved">
                    {formatDateTime(b.rescheduled_at)}
                    <span className="block text-muted-foreground">
                      from {formatDateTime(b.rescheduled_from)}
                      {b.reschedule_count > 0 &&
                        ` (the customer has moved it ${b.reschedule_count === 1 ? "once" : `${b.reschedule_count} times`})`}
                    </span>
                  </Row>
                )}
              </Rows>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* The main actions, in reach however far down the page you are. */}
      <div className="sticky bottom-(--bottom-nav) z-10 -mx-4 -mb-6 mt-6 border-t bg-background/95 px-4 py-3 backdrop-blur empty:hidden supports-[backdrop-filter]:bg-background/80 md:-mx-8 md:-mb-8 md:px-8">
        {b.status === "requested"
          ? can("bookings.manage") && (
              <ApprovalActions
                slug={slug}
                bookingId={b.id}
                customer={b.customer?.name ?? "this customer"}
                depositPaid={b.deposit_status === "paid"}
              />
            )
          : b.status !== "expired" && (
              <JobActions
                status={b.status}
                depositPaid={b.deposit_status === "paid"}
                customer={b.customer?.name ?? "this customer"}
                action={setBookingStatusAction.bind(null, slug, b.id)}
                canManage={can("bookings.manage")}
                refund={refundOffer}
              />
            )}
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
