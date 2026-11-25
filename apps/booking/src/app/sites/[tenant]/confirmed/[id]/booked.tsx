import { CalendarPlus, Check, Clock, MapPin, PencilLine } from "lucide-react";
import { formatDuration, formatPence } from "@leadgen/core/booking/config";
import { amountsDue, bookingReference, googleCalendarUrl, type CalendarEntry } from "@leadgen/core/booking/confirmation";
import type { BookingSummary } from "@leadgen/core/booking/engine";
import { ContactLinks } from "@/components/contact-links";
import { container } from "@/components/site";
import { cn } from "@/lib/cn";

const button =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-neutral-300 bg-surface px-4 text-sm font-medium text-neutral-900 transition hover:border-neutral-500";

export function calendarEntry(id: string, booking: BookingSummary, businessName: string, contact: { phone: string | null; email: string | null }): CalendarEntry {
  return {
    id,
    title: `${booking.serviceName ?? "Booking"} with ${businessName}`,
    start: new Date(booking.startsAt),
    end: new Date(booking.endsAt),
    location: booking.address,
    details: [`Reference ${bookingReference(id)}`, contact.phone, contact.email].filter(Boolean).join("\n"),
  };
}

// The day and time in the business's time zone, in parts for the date tile:
// "Monday", "30", "November", "09:00", "17:00".
function whenParts(startsAt: string, endsAt: string, timeZone: string) {
  const part = (date: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone, ...options }).format(new Date(date));
  const time = (date: string) => part(date, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return {
    weekday: part(startsAt, { weekday: "long" }),
    day: part(startsAt, { day: "numeric" }),
    month: part(startsAt, { month: "long" }),
    year: part(startsAt, { year: "numeric" }),
    start: time(startsAt),
    end: time(endsAt),
  };
}

// The page once a booking is in: a band saying so, then the booking itself
// (when, where, how long) with what happens next and how to change it, and
// beside it what's paid and what's left, adding it to a calendar and getting
// in touch. A request waiting for approval gets the same page, minus the
// calendar entry, as it may yet be turned down.
export function Booked({
  id,
  booking,
  businessName,
  contact,
  manageUrl,
  icsUrl,
}: {
  id: string;
  booking: BookingSummary;
  businessName: string;
  contact: { phone: string | null; email: string | null };
  manageUrl: string | null;
  icsUrl: string;
}) {
  const requested = booking.status === "requested";
  const { paidPence, balancePence } = amountsDue(booking);
  const when = whenParts(booking.startsAt, booking.endsAt, booking.timezone);
  const minutes = Math.round((new Date(booking.endsAt).getTime() - new Date(booking.startsAt).getTime()) / 60_000);
  const reference = bookingReference(id);

  const next = requested
    ? [
        `${businessName} will check your booking and confirm it.${booking.emailsCustomer ? " We'll email you either way." : ""}`,
        paidPence > 0 ? "If they can't take it, your deposit is refunded in full." : "The time is kept for you until they reply.",
      ]
    : [
        booking.emailsCustomer && booking.customerEmail ? `Your confirmation is on its way to ${booking.customerEmail}.` : null,
        booking.remindsCustomer ? "We'll email you a reminder before the day." : null,
        booking.locationType === "unit"
          ? `Bring the car to ${booking.address} for ${when.start} on ${when.weekday}.`
          : `${businessName} will come to ${booking.address} for ${when.start} on ${when.weekday}. Please make sure they can get to the car.`,
        booking.needsInspection ? `${businessName} will confirm the final price when they see the car.` : null,
      ].filter((line): line is string => line !== null);

  const payment = (
    <section aria-label="Payment" className="grid gap-4 rounded-2xl border bg-surface p-5 shadow-xs sm:p-6">
      <h2 className="text-lg font-semibold">
        Payment
      </h2>
      <dl className="grid gap-2.5 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-neutral-600">{booking.needsInspection ? "Price so far" : "Price"}</dt>
          <dd className="tabular-nums">{formatPence(booking.pricePence)}</dd>
        </div>
        {booking.depositPence > 0 && (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-neutral-600">Deposit</dt>
            <dd className="text-right tabular-nums">
              {paidPence > 0 ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-900">Paid</span>
                  {formatPence(paidPence)}
                </span>
              ) : (
                `${formatPence(booking.depositPence)}, not paid yet`
              )}
            </dd>
          </div>
        )}
      </dl>
      <div className="grid gap-1 rounded-xl bg-neutral-50 p-4 ring-1 ring-neutral-200/70">
        <p className="text-sm text-neutral-600">{balancePence > 0 ? "Left to pay on the day" : "Left to pay"}</p>
        <p className="font-heading text-3xl leading-none font-semibold tabular-nums">
          {balancePence > 0 ? formatPence(balancePence) : "Nothing"}
        </p>
        {booking.needsInspection && <p className="mt-1 text-xs text-neutral-500">The final price is confirmed when they see the car.</p>}
      </div>
    </section>
  );

  return (
    <>
      {/* ------------------------------------------------------------ band */}
      <section className="bg-wash">
        <div className={cn(container, "grid justify-items-center gap-4 py-10 text-center sm:py-14")}>
          <span
            aria-hidden
            className={cn(
              "grid size-16 place-items-center rounded-full text-white shadow-lg ring-8",
              requested ? "bg-amber-500 ring-amber-500/15" : "bg-emerald-600 ring-emerald-600/15",
            )}
          >
            {requested ? <Clock className="size-8" /> : <Check className="size-8" strokeWidth={2.5} />}
          </span>
          <div className="grid gap-2">
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{requested ? "Booking request sent" : "You're booked in"}</h1>
            <p className="text-pretty text-neutral-700">
              {requested
                ? `${businessName} will confirm it soon.`
                : `Thanks for booking with ${businessName}. We look forward to seeing you${booking.serviceName ? ` for your ${booking.serviceName.toLowerCase()}` : ""}.`}
            </p>
          </div>
          <p className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1 text-sm ring-1 ring-black/5">
            <span className="text-neutral-500">Reference</span>
            <span className="font-mono font-semibold tracking-wide">{reference}</span>
          </p>
        </div>
      </section>

      <div className={cn(container, "grid gap-6 py-8 sm:py-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-8")}>
        {/* ------------------------------------------------- the booking */}
        <div className="grid gap-6">
          <section aria-label="Your booking" className="overflow-hidden rounded-2xl border bg-surface shadow-xs">
            <div className="flex flex-wrap items-center gap-5 p-5 sm:p-6">
              {/* The date as a calendar tile. */}
              <div aria-hidden className="grid w-20 shrink-0 overflow-hidden rounded-xl text-center ring-1 ring-neutral-200">
                <span className="bg-brand py-1 text-xs font-semibold tracking-wide text-brand-fg uppercase">{when.month.slice(0, 3)}</span>
                <span className="py-1.5 font-heading text-3xl leading-none font-semibold">{when.day}</span>
                <span className="pb-1.5 text-xs text-neutral-500">{when.weekday.slice(0, 3)}</span>
              </div>
              <div className="grid min-w-0 gap-1">
                <p className="text-sm text-neutral-500">{requested ? "Requested for" : "Booked for"}</p>
                <p className="text-xl font-semibold tracking-tight text-balance">
                  {when.weekday} {when.day} {when.month}
                </p>
                <p className="text-neutral-700 tabular-nums">
                  {when.start} – {when.end} <span className="text-neutral-500">· about {formatDuration(minutes)}</span>
                </p>
              </div>
            </div>
            <dl className="grid gap-4 border-t bg-neutral-50/60 p-5 text-sm sm:grid-cols-2 sm:p-6">
              {booking.serviceName && (
                <div className="grid gap-0.5">
                  <dt className="text-neutral-500">Service</dt>
                  <dd className="font-medium text-neutral-900">{booking.serviceName}</dd>
                </div>
              )}
              <div className="grid gap-0.5">
                <dt className="text-neutral-500">{booking.locationType === "unit" ? "At" : "Where"}</dt>
                <dd className="flex items-start gap-1.5 font-medium text-neutral-900">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-neutral-400" aria-hidden />
                  {booking.address}
                </dd>
              </div>
            </dl>
          </section>

          {/* On a phone, what's paid and what's left comes straight after the booking. */}
          <div className="lg:hidden">{payment}</div>

          <section aria-labelledby="next-heading" className="grid gap-4 rounded-2xl border bg-surface p-5 sm:p-6">
            <h2 id="next-heading" className="text-lg font-semibold">
              What happens next
            </h2>
            <ol className="grid">
              {next.map((line, i) => (
                <li key={line} className="relative flex gap-4 pb-5 last:pb-0">
                  {/* The line joining the steps. */}
                  {i < next.length - 1 && <span aria-hidden className="absolute top-8 bottom-1 left-[0.9375rem] w-px bg-neutral-200" />}
                  <span aria-hidden className="relative grid size-8 shrink-0 place-items-center rounded-full bg-wash text-sm font-semibold text-brand ring-1 ring-black/5">
                    {i + 1}
                  </span>
                  <span className="pt-1 text-pretty text-neutral-700">{line}</span>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="change-heading" className="grid gap-3 rounded-2xl border bg-surface p-5 sm:p-6">
            <h2 id="change-heading" className="text-lg font-semibold">
              Need to change it?
            </h2>
            {manageUrl ? (
              <>
                <p className="text-sm text-pretty text-neutral-600">You can move or cancel it yourself. The same link is in your email.</p>
                <a href={manageUrl} className={cn(button, "w-fit")}>
                  <PencilLine className="size-4" aria-hidden /> Change or cancel your booking
                </a>
              </>
            ) : (
              <p className="text-sm text-pretty text-neutral-600">Get in touch with {businessName} and they&apos;ll sort it out.</p>
            )}
          </section>
        </div>

        {/* ------------------------------------------------------ beside it */}
        <aside className="grid gap-6">
          <div className="hidden lg:grid">{payment}</div>

          {!requested && (
            <section aria-labelledby="calendar-heading" className="grid gap-3 rounded-2xl border bg-surface p-5 sm:p-6">
              <h2 id="calendar-heading" className="text-lg font-semibold">
                Add to your calendar
              </h2>
              <div className="grid gap-2">
                <a href={googleCalendarUrl(calendarEntry(id, booking, businessName, contact))} target="_blank" rel="noopener noreferrer" className={button}>
                  <CalendarPlus className="size-4" aria-hidden /> Google Calendar
                </a>
                <a href={icsUrl} className={button}>
                  <CalendarPlus className="size-4" aria-hidden /> Apple or Outlook
                </a>
              </div>
            </section>
          )}

          {(contact.phone || contact.email) && (
            <section aria-labelledby="contact-heading" className="grid gap-3 rounded-2xl border bg-surface p-5 sm:p-6">
              <h2 id="contact-heading" className="text-lg font-semibold">
                Questions?
              </h2>
              <p className="text-sm text-neutral-600">Get in touch with {businessName}. Quote your reference, {reference}.</p>
              <ContactLinks phone={contact.phone} email={contact.email} />
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
