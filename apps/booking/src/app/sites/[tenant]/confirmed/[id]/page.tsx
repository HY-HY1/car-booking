import type { Metadata } from "next";
import Link from "next/link";
import { Check, Clock } from "lucide-react";
import { formatPence } from "@leadgen/core/booking/config";
import { getBookingSummary } from "@leadgen/core/booking/engine";
import { confirmFromCheckout } from "@leadgen/core/stripe/payments";
import { requireRequestTenant } from "@/lib/tenant";
import { pageUrl } from "@/lib/urls";
import { resumePaymentAction } from "./actions";
import { RefreshWhileWaiting } from "./refresh-while-waiting";

export const metadata: Metadata = { title: "Your booking" };

// Where Stripe sends the customer after the deposit page. The webhook
// confirms the payment, so it still happens if the customer closed the tab
// on Stripe. While the booking is still held, this page also asks Stripe
// itself, so a late or missing webhook doesn't leave a paid booking held.
export default async function ConfirmedPage({ params, searchParams }: PageProps<"/sites/[tenant]/confirmed/[id]">) {
  const tenant = await requireRequestTenant();
  const { id } = await params;
  const cancelled = (await searchParams).cancelled === "1";
  let booking = await getBookingSummary(tenant.id, id);
  const waiting = booking?.status === "held" || (booking?.status === "expired" && booking.depositStatus === "pending");
  if (waiting && !cancelled) {
    try {
      if (await confirmFromCheckout(tenant.id, id)) booking = await getBookingSummary(tenant.id, id);
    } catch (error) {
      // The webhook may still get there; the page keeps checking.
      console.error("Checking the deposit with Stripe failed", error);
    }
  }

  return (
    <main className="flex flex-1 flex-col">
      <header className="bg-brand px-4 py-3 text-brand-fg">
        <Link href={pageUrl(tenant)} className="font-semibold">
          {tenant.name}
        </Link>
      </header>
      <div className="mx-auto grid w-full max-w-lg flex-1 content-start justify-items-center gap-3 px-4 py-12 text-center">
        {!booking ? (
          <Message title="We couldn't find that booking">
            <Again href={pageUrl(tenant, "/quote")} />
          </Message>
        ) : booking.status === "confirmed" ? (
          <>
            <div className="grid size-14 place-items-center rounded-full bg-brand text-brand-fg">
              <Check className="size-7" />
            </div>
            <h1 className="text-2xl font-semibold">You&apos;re booked in</h1>
            <p className="text-neutral-600">
              {booking.serviceName ? `${booking.serviceName}, ` : ""}
              {formatInstant(booking.startsAt, booking.timezone)}.
            </p>
            <p className="max-w-sm text-sm text-neutral-500">
              {booking.depositStatus === "paid"
                ? `Your ${formatPence(booking.depositPence)} deposit is paid. ${tenant.name} will be in touch before the day.`
                : `${tenant.name} will be in touch before the day.`}
            </p>
          </>
        ) : booking.status === "requested" ? (
          <>
            <div className="grid size-14 place-items-center rounded-full bg-brand text-brand-fg">
              <Clock className="size-7" />
            </div>
            <h1 className="text-2xl font-semibold">Booking request sent</h1>
            <p className="text-neutral-600">
              {booking.serviceName ? `${booking.serviceName}, ` : ""}
              {formatInstant(booking.startsAt, booking.timezone)}.
            </p>
            <p className="max-w-sm text-sm text-neutral-500">
              {booking.depositStatus === "paid"
                ? `Your ${formatPence(booking.depositPence)} deposit is paid. ${tenant.name} will confirm your booking shortly; if they can't take it, your deposit is refunded in full.`
                : `${tenant.name} will confirm your booking shortly. The time is kept for you until they do.`}
            </p>
          </>
        ) : booking.status === "held" && !cancelled ? (
          <>
            <RefreshWhileWaiting />
            <div className="grid size-14 place-items-center rounded-full bg-neutral-200 text-neutral-600">
              <Clock className="size-7" />
            </div>
            <h1 className="text-2xl font-semibold">Confirming your payment…</h1>
            <p className="max-w-sm text-sm text-neutral-500">
              This usually takes a few seconds. You can close this page; we&apos;ll confirm your booking
              either way.
            </p>
          </>
        ) : booking.status === "held" ? (
          <>
            <h1 className="text-2xl font-semibold">Your deposit isn&apos;t paid yet</h1>
            <p className="max-w-sm text-sm text-neutral-500">
              We&apos;re holding {formatInstant(booking.startsAt, booking.timezone)} for you for a little
              longer. Pay the {formatPence(booking.depositPence)} deposit to secure it.
            </p>
            <form action={resumePaymentAction.bind(null, id)}>
              <button
                type="submit"
                className="mt-2 inline-flex h-12 items-center rounded-full bg-brand px-6 font-medium text-brand-fg transition hover:opacity-90"
              >
                Pay deposit
              </button>
            </form>
          </>
        ) : booking.depositStatus === "refunded" ? (
          <Message title="That time was taken">
            <p className="max-w-sm text-sm text-neutral-500">
              Your payment arrived just after the time had been released and someone else had booked it.
              We&apos;ve refunded your deposit in full; it can take a few days to show on your statement.
            </p>
            <Again href={pageUrl(tenant, "/quote")} />
          </Message>
        ) : (
          <Message title="This booking isn't being held any more">
            <p className="max-w-sm text-sm text-neutral-500">
              The time ran out before the deposit was paid. If you were charged, you&apos;ll be refunded
              automatically.
            </p>
            <Again href={pageUrl(tenant, "/quote")} />
          </Message>
        )}
      </div>
    </main>
  );
}

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <h1 className="text-2xl font-semibold">{title}</h1>
      {children}
    </>
  );
}

function Again({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="mt-2 inline-flex h-12 items-center rounded-full bg-brand px-6 font-medium text-brand-fg transition hover:opacity-90"
    >
      Pick another time
    </Link>
  );
}

function formatInstant(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(iso));
}
