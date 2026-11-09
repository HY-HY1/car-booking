import { CalendarPlus, Check, Clock } from "lucide-react";
import { formatDuration, formatPence } from "@leadgen/core/booking/config";
import { amountsDue, bookingReference, googleCalendarUrl, type CalendarEntry } from "@leadgen/core/booking/confirmation";
import type { BookingSummary } from "@leadgen/core/booking/engine";
import { formatFullDateTime } from "@leadgen/core/dates";
import { ContactLinks } from "@/components/contact-links";

const button =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-neutral-300 bg-white px-4 text-sm font-medium transition hover:border-neutral-400";

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

// The page once a booking is in: everything about it, what happens now, and
// how to change it. A request waiting for approval gets the same page, minus
// the calendar entry, as it may yet be turned down.
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
  const when = formatFullDateTime(booking.startsAt, booking.timezone);
  const minutes = Math.round((new Date(booking.endsAt).getTime() - new Date(booking.startsAt).getTime()) / 60_000);

  const next = requested
    ? [
        `${businessName} will check your booking and confirm it.${booking.emailsCustomer ? " We'll email you either way." : ""}`,
        paidPence > 0 ? "If they can't take it, your deposit is refunded in full." : "The time is kept for you until they reply.",
      ]
    : [
        booking.emailsCustomer && booking.customerEmail ? `Your confirmation is on its way to ${booking.customerEmail}.` : null,
        booking.remindsCustomer ? "We'll email you a reminder before the day." : null,
        booking.locationType === "unit"
          ? `Bring the car to ${booking.address} for the time above.`
          : `${businessName} will come to ${booking.address} for the time above. Please make sure they can get to the car.`,
        booking.needsInspection ? `${businessName} will confirm the final price when they see the car.` : null,
      ].filter((line): line is string => line !== null);

  return (
    <>
      <div className="grid size-14 place-items-center rounded-full bg-brand text-brand-fg">
        {requested ? <Clock className="size-7" /> : <Check className="size-7" />}
      </div>
      <h1 className="text-2xl font-semibold">{requested ? "Booking request sent" : "You're booked in"}</h1>
      <p className="text-neutral-600">
        {booking.serviceName ? `${booking.serviceName}, ` : ""}
        {when}
      </p>

      <dl className="mt-3 grid w-full grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-2xl border bg-white p-4 text-left text-sm">
        <dt className="text-neutral-500">Reference</dt>
        <dd className="text-right font-mono font-medium">{bookingReference(id)}</dd>
        <dt className="text-neutral-500">Takes about</dt>
        <dd className="text-right">{formatDuration(minutes)}</dd>
        <dt className="text-neutral-500">Where</dt>
        <dd className="text-right">{booking.address}</dd>
        <div aria-hidden className="col-span-2 my-1 border-t" />
        <dt className="text-neutral-500">{booking.needsInspection ? "Price so far" : "Price"}</dt>
        <dd className="text-right">{formatPence(booking.pricePence)}</dd>
        {booking.depositPence > 0 && (
          <>
            <dt className="text-neutral-500">{paidPence > 0 ? "Deposit paid" : "Deposit"}</dt>
            <dd className="text-right">{paidPence > 0 ? formatPence(paidPence) : `${formatPence(booking.depositPence)}, not paid yet`}</dd>
          </>
        )}
        <dt className="font-medium">Balance due</dt>
        <dd className="text-right font-medium">{balancePence > 0 ? formatPence(balancePence) : "Nothing more to pay"}</dd>
      </dl>

      <section className="mt-3 grid w-full gap-2 text-left" aria-labelledby="next-heading">
        <h2 id="next-heading" className="font-semibold">What happens next</h2>
        <ol className="grid gap-2 text-sm text-neutral-700">
          {next.map((line, i) => (
            <li key={line} className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-neutral-100 text-xs font-medium">{i + 1}</span>
              <span className="pt-0.5">{line}</span>
            </li>
          ))}
        </ol>
      </section>

      {!requested && (
        <section className="mt-3 grid w-full gap-2 text-left" aria-labelledby="calendar-heading">
          <h2 id="calendar-heading" className="font-semibold">Add to your calendar</h2>
          <div className="flex flex-wrap gap-2">
            <a href={googleCalendarUrl(calendarEntry(id, booking, businessName, contact))} target="_blank" rel="noopener noreferrer" className={button}>
              <CalendarPlus className="size-4" /> Google Calendar
            </a>
            <a href={icsUrl} className={button}>
              <CalendarPlus className="size-4" /> Apple or Outlook
            </a>
          </div>
        </section>
      )}

      <section className="mt-3 grid w-full gap-2 text-left" aria-labelledby="change-heading">
        <h2 id="change-heading" className="font-semibold">Need to change it?</h2>
        {manageUrl ? (
          <>
            <p className="text-sm text-neutral-700">You can move or cancel it yourself. The same link is in your email.</p>
            <a href={manageUrl} className={`${button} w-fit`}>
              Change or cancel your booking
            </a>
          </>
        ) : (
          <p className="text-sm text-neutral-700">Get in touch with {businessName} and they&apos;ll sort it out.</p>
        )}
      </section>

      {(contact.phone || contact.email) && (
        <section className="mt-3 grid w-full gap-2 text-left" aria-labelledby="contact-heading">
          <h2 id="contact-heading" className="font-semibold">Contact {businessName}</h2>
          <ContactLinks phone={contact.phone} email={contact.email} />
        </section>
      )}
    </>
  );
}
