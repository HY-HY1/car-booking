import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Mail, MapPin, Phone } from "lucide-react";
import { formatPence } from "@leadgen/core/booking/config";
import { bookingReference } from "@leadgen/core/booking/confirmation";
import { getManagedBooking } from "@leadgen/core/booking/manage";
import { blockedLine, type Option } from "@leadgen/core/booking/manage-rules";
import { requireRequestTenant } from "@/lib/tenant";
import { pageUrl } from "@/lib/urls";
import { payBalanceAction, payDepositAction } from "./actions";
import { ManageActions, type ActionView } from "./manage-actions";
import { formatFullDateTime } from "@leadgen/core/dates";

// The link carries the right to change the booking, so it's kept out of
// search engines and out of the Referer sent to any page linked from here.
export const metadata: Metadata = { title: "Your booking", robots: { index: false }, referrer: "no-referrer" };

// /manage/<signed token>, linked from the customer's confirmation and
// reminder emails. Showing the page changes nothing (mail scanners open
// links); cancelling or moving takes a button press, and each is checked
// against the policy again when it's made (booking/manage.ts).
export default async function ManagePage({ params, searchParams }: PageProps<"/sites/[tenant]/manage/[token]">) {
  const tenant = await requireRequestTenant();
  const { token } = await params;
  const sp = await searchParams;
  const booking = await getManagedBooking(tenant.id, token);

  return (
    <main className="flex flex-1 flex-col">
      <header className="bg-brand px-4 py-3 text-brand-fg">
        <Link href={pageUrl(tenant)} className="font-semibold">
          {tenant.name}
        </Link>
      </header>
      <div className="mx-auto grid w-full max-w-lg flex-1 content-start gap-6 px-4 py-10">
        {!booking ? (
          <div className="grid gap-3 text-center">
            <h1 className="text-2xl font-semibold">That link isn&apos;t working</h1>
            <p className="text-sm text-neutral-500">
              It may have been copied only in part. Open it again from your booking email, or get in touch with{" "}
              {tenant.name}.
            </p>
            <Contact contact={tenant.contact} />
          </div>
        ) : (
          <>
            <div className="grid gap-1">
              <p className="text-sm font-medium text-neutral-500">{STATUS_LINE[booking.status] ?? "Your booking"}</p>
              <h1 className="text-2xl font-semibold">{booking.serviceName ?? "Your booking"}</h1>
            </div>

            <dl className="grid gap-3 rounded-2xl border bg-white p-4 text-sm">
              <Detail icon={<CalendarDays className="size-4" />} label="When">
                {formatFullDateTime(booking.startsAt, booking.timezone)}
              </Detail>
              <Detail icon={<MapPin className="size-4" />} label="Where">
                {booking.locationType === "unit" ? `Drop-off at ${booking.address}` : booking.address}
              </Detail>
              <div className="flex justify-between gap-4 border-t pt-3">
                <dt className="text-neutral-500">Reference</dt>
                <dd className="font-mono">{bookingReference(booking.bookingId)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-neutral-500">Price</dt>
                <dd className="font-medium">{formatPence(booking.pricePence)}</dd>
              </div>
              {booking.depositPence > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-neutral-500">Deposit</dt>
                  <dd>
                    {formatPence(booking.depositPence)}
                    {DEPOSIT_LINE[booking.depositStatus] && (
                      <span className="text-neutral-500"> · {DEPOSIT_LINE[booking.depositStatus]}</span>
                    )}
                  </dd>
                </div>
              )}
            </dl>

            {booking.canPayDeposit && (
              <form
                action={payDepositAction.bind(null, token)}
                className="grid gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
              >
                <p>
                  {sp.cancelled === "1"
                    ? `Your ${formatPence(booking.depositPence)} deposit hasn't been paid yet. You can try again whenever you're ready.`
                    : `Please pay your ${formatPence(booking.depositPence)} deposit to secure this booking.`}
                </p>
                <button
                  type="submit"
                  className="inline-flex h-11 w-fit items-center rounded-full bg-brand px-5 font-medium text-brand-fg transition hover:opacity-90"
                >
                  Pay {formatPence(booking.depositPence)} deposit
                </button>
              </form>
            )}
            {booking.balanceToPayPence > 0 && (
              <form action={payBalanceAction.bind(null, token)} className="grid gap-3 rounded-2xl border bg-white p-4 text-sm">
                <p>
                  You have <span className="font-medium">{formatPence(booking.balanceToPayPence)}</span> left to pay. You can pay it now if you&apos;d like to.
                </p>
                <button
                  type="submit"
                  className="inline-flex h-11 w-fit items-center rounded-full bg-brand px-5 font-medium text-brand-fg transition hover:opacity-90"
                >
                  Pay {formatPence(booking.balanceToPayPence)}
                </button>
              </form>
            )}
            {sp.pay === "unavailable" && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-900">
                This can&apos;t be paid online right now. Get in touch with {tenant.name} using the details below.
              </p>
            )}

            {booking.status === "confirmed" || booking.status === "requested" ? (
              <>
                <ManageActions
                  token={token}
                  startsAt={booking.startsAt}
                  reschedule={view(booking.options.reschedule, "reschedule", booking)}
                  cancel={view(booking.options.cancel, "cancel", booking)}
                  refundLine={booking.refundLine}
                />
                {booking.policyLines && (
                  <section className="grid gap-1.5 text-sm text-neutral-600">
                    <h2 className="font-medium text-neutral-900">Cancellation policy</h2>
                    {booking.policyLines.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </section>
                )}
              </>
            ) : (
              (booking.status === "cancelled" || booking.status === "completed") && (
                <Link
                  href={pageUrl(tenant, "/quote")}
                  className="inline-flex h-12 w-fit items-center rounded-full bg-brand px-6 font-medium text-brand-fg transition hover:opacity-90"
                >
                  {booking.status === "completed" ? "Book again" : "Book another time"}
                </Link>
              )
            )}

            {booking.hasInvoice && (
              <a href={pageUrl(tenant, `/manage/${token}/invoice`)} target="_blank" rel="noreferrer" className="w-fit text-sm text-neutral-600 underline underline-offset-4">
                View your invoice
              </a>
            )}

            <section className="grid gap-2 text-sm">
              <h2 className="font-medium">Questions about your booking?</h2>
              <Contact contact={tenant.contact} />
            </section>
          </>
        )}
      </div>
    </main>
  );
}

const STATUS_LINE: Record<string, string> = {
  confirmed: "You're booked in",
  requested: "Waiting for the business to confirm",
  cancelled: "This booking is cancelled",
  completed: "This job is done",
  no_show: "This booking has passed",
};

const DEPOSIT_LINE: Record<string, string> = {
  paid: "paid",
  pending: "not paid yet",
  refunded: "refunded",
  partially_refunded: "partly refunded",
};

function view(
  option: Option,
  what: "cancel" | "reschedule",
  booking: { timezone: string; policy: Parameters<typeof blockedLine>[2] },
): ActionView {
  return option.allowed
    ? { allowed: true, until: formatFullDateTime(option.until.toISOString(), booking.timezone) }
    : { allowed: false, reason: blockedLine(what, option.why, booking.policy) };
}

function Detail({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="mt-0.5 text-neutral-400" aria-label={label}>
        {icon}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

function Contact({ contact }: { contact: { email: string | null; phone: string | null } }) {
  if (!contact.email && !contact.phone) return <p className="text-neutral-500">Reply to your booking email.</p>;
  return (
    <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 sm:justify-start">
      {contact.phone && (
        <a href={`tel:${contact.phone}`} className="flex items-center gap-2 hover:underline">
          <Phone className="size-4 text-neutral-400" />
          {contact.phone}
        </a>
      )}
      {contact.email && (
        <a href={`mailto:${contact.email}`} className="flex items-center gap-2 break-all hover:underline">
          <Mail className="size-4 shrink-0 text-neutral-400" />
          {contact.email}
        </a>
      )}
    </div>
  );
}
