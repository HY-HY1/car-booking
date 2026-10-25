"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { Camera, ChevronRight } from "lucide-react";
import { answersOf } from "@leadgen/core/booking/answers";
import { formatDuration, formatPence } from "@leadgen/core/booking/config";
import { PAYABLE_BOOKING_STATUSES, paymentSummary } from "@leadgen/core/stripe/payment-rules";
import {
  accessRowsOf,
  BOOKING_SOURCE,
  BOOKING_STATUS,
  DEPOSIT_STATUS,
  quoteOf,
  SIZE_NAME,
  submittedGroups,
} from "@/lib/booking-display";
import { ConditionNote } from "@/components/dashboard/condition-note";
import { SubmittedAnswers } from "@/components/dashboard/submitted-answers";
import { cn } from "@/lib/utils";
import { appUrl } from "@/lib/urls";

// The bookings list. Each row opens to show everything about the booking
// without leaving the page; the full page (with refunds) is one link away.

export type BookingTableRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  created_at: string;
  status: string;
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
  // Paid so far (net of refunds), from the payments ledger.
  paid_pence: number;
  customer: { id: string; name: string; email: string | null; phone: string | null } | null;
  service: { name: string } | null;
  vehicle: { make: string | null; model: string | null; registration: string | null; size_class: string | null } | null;
  photos: { count: number }[];
};

const COLUMNS = 6;

function summaryOf(b: BookingTableRow) {
  return paymentSummary(b, [{ status: "paid", amountPence: b.paid_pence, refundedPence: 0 }]);
}

// The line under the price. Once a booking is on, it says how much has been
// paid; before that (a hold, a cancelled job) it's just the deposit's state.
function paymentLine(b: BookingTableRow) {
  const deposit = `${DEPOSIT_STATUS[b.deposit_status] ?? b.deposit_status}${b.deposit_pence > 0 ? ` · ${formatPence(b.deposit_pence)}` : ""}`;
  if (!(PAYABLE_BOOKING_STATUSES as readonly string[]).includes(b.status)) return deposit;
  const s = summaryOf(b);
  if (s.fullyPaid && b.price_pence > 0) return "Paid in full";
  if (s.paidPence > 0) return `${formatPence(s.paidPence)} paid · ${formatPence(s.balancePence)} to pay`;
  return deposit;
}

export function BookingsTable({ rows, slug }: { rows: BookingTableRow[]; slug: string }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-muted-foreground">
          <tr>
            <th className="px-4 py-2 font-medium">When</th>
            <th className="px-4 py-2 font-medium">Customer</th>
            <th className="px-4 py-2 font-medium">Service</th>
            <th className="px-4 py-2 font-medium">Where</th>
            <th className="px-4 py-2 font-medium">Price</th>
            <th className="px-4 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((b) => {
            const open = openId === b.id;
            const detailsId = `booking-${b.id}`;
            return (
              <Fragment key={b.id}>
                <tr
                  className={cn("cursor-pointer hover:bg-muted/30", open && "bg-muted/30")}
                  onClick={() => setOpenId(open ? null : b.id)}
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-start gap-2">
                      {/* The button is the keyboard route in; a click on it
                          bubbles to the row, which does the toggling. */}
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-controls={detailsId}
                        aria-label={open ? "Hide details" : "Show details"}
                        className="mt-0.5 rounded text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <ChevronRight className={cn("size-4 transition-transform", open && "rotate-90")} />
                      </button>
                      <span>
                        {formatWhen(b.starts_at)}
                        <span className="text-muted-foreground"> to {formatTime(b.ends_at)}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {b.customer ? (
                      <Link
                        href={appUrl(`/${slug}/customers/${b.customer.id}`)}
                        onClick={(e) => e.stopPropagation()}
                        className="underline-offset-4 hover:underline"
                      >
                        {b.customer.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                    {b.customer && b.photos[0]?.count > 0 && (
                      <Link
                        href={appUrl(`/${slug}/customers/${b.customer.id}#photos`)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5 flex w-fit items-center gap-1 text-xs font-normal text-muted-foreground hover:text-foreground"
                      >
                        <Camera className="size-3.5" />
                        {b.photos[0].count} {b.photos[0].count === 1 ? "photo" : "photos"}
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {b.service?.name ?? "—"}
                    {b.vehicle?.make && (
                      <span className="block text-xs text-muted-foreground">
                        {b.vehicle.make} {b.vehicle.model}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{b.location_type === "unit" ? "Drop-off" : b.postcode}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatPence(b.price_pence)}
                    <span className="block text-xs text-muted-foreground">{paymentLine(b)}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{BOOKING_STATUS[b.status] ?? b.status}</td>
                </tr>
                {open && (
                  <tr id={detailsId} className="bg-muted/20">
                    <td colSpan={COLUMNS} className="px-4 py-4">
                      <Details b={b} slug={slug} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------------ details

function Details({ b, slug }: { b: BookingTableRow; slug: string }) {
  const quote = quoteOf(b.quote_snapshot);
  const accessRows = accessRowsOf(b.access_notes);
  const payment = summaryOf(b);

  const car = [b.vehicle?.make, b.vehicle?.model].filter(Boolean).join(" ");

  return (
    <div className="grid gap-x-8 gap-y-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
      <Section title="Customer">
        {b.customer ? (
          <>
            <p className="font-medium">{b.customer.name}</p>
            {b.customer.phone && (
              <p>
                <a href={`tel:${b.customer.phone}`} className="underline-offset-4 hover:underline">
                  {b.customer.phone}
                </a>
              </p>
            )}
            {b.customer.email && (
              <p className="break-all">
                <a href={`mailto:${b.customer.email}`} className="underline-offset-4 hover:underline">
                  {b.customer.email}
                </a>
              </p>
            )}
          </>
        ) : (
          <p className="text-muted-foreground">No customer on this booking.</p>
        )}
      </Section>

      <Section title="Vehicle">
        {car || b.vehicle?.registration ? (
          <>
            {car && <p className="font-medium">{car}</p>}
            {b.vehicle?.registration && <p className="font-mono">{b.vehicle.registration}</p>}
            {b.vehicle?.size_class && <p className="text-muted-foreground">{SIZE_NAME[b.vehicle.size_class] ?? b.vehicle.size_class} size</p>}
          </>
        ) : (
          <p className="text-muted-foreground">Not recorded.</p>
        )}
      </Section>

      <Section title="Where">
        {b.location_type === "unit" ? (
          <p>Drop-off at your unit</p>
        ) : (
          <p>{[b.address_line, b.postcode].filter(Boolean).join(", ")}</p>
        )}
        {accessRows.map(([label, value]) => (
          <p key={label}>
            <span className="text-muted-foreground">{label}: </span>
            {value}
          </p>
        ))}
      </Section>

      <Section title="Price">
        {quote && quote.lines.length > 0 ? (
          <ul className="grid gap-1">
            {quote.lines.map((l, i) => (
              <li key={i} className="flex justify-between gap-4">
                <span className="text-muted-foreground">{l.label}</span>
                <span>{formatPence(l.amount_pence)}</span>
              </li>
            ))}
            <li className="mt-1 flex justify-between gap-4 border-t pt-1 font-medium">
              <span>Total</span>
              <span>{formatPence(b.price_pence)}</span>
            </li>
          </ul>
        ) : (
          <p className="font-medium">{formatPence(b.price_pence)}</p>
        )}
        {quote?.durationMins && <p className="text-muted-foreground">About {formatDuration(quote.durationMins)}</p>}
        {quote && <ConditionNote condition={quote.condition} needsInspection={quote.needsInspection} size="xs" />}
      </Section>

      <Section title="Payment">
        <p>
          {DEPOSIT_STATUS[b.deposit_status] ?? b.deposit_status}
          {b.deposit_pence > 0 && ` · ${formatPence(b.deposit_pence)}`}
        </p>
        <p className="text-muted-foreground">
          {formatPence(payment.paidPence)} paid ·{" "}
          {payment.fullyPaid && b.price_pence > 0 ? "nothing to pay" : `${formatPence(payment.balancePence)} to pay`}
        </p>
      </Section>

      <Section title="Booked">
        <p className="text-muted-foreground">
          {formatWhen(b.created_at)} · {BOOKING_SOURCE[b.source] ?? b.source}
        </p>
      </Section>

      <div className="sm:col-span-2 lg:col-span-3">
        <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Everything they submitted</h3>
        <SubmittedAnswers
          groups={submittedGroups({
            answers: answersOf(b.quote_snapshot),
            vehicle: b.vehicle,
            access: b.access_notes,
            notes: b.customer_notes,
            postcode: b.postcode,
            addressLine: b.address_line,
            locationType: b.location_type,
          })}
        />
      </div>

      <div className="sm:col-span-2 lg:col-span-3">
        <Link
          href={appUrl(`/${slug}/bookings/${b.id}`)}
          className="text-sm font-medium underline-offset-4 hover:underline"
        >
          Open the full booking{b.deposit_status === "paid" ? " (refunds)" : ""} →
        </Link>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid content-start gap-1">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  );
}

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(new Date(iso));
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(new Date(iso));
}
