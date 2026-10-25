import Link from "next/link";
import { Mail, MapPin, Phone, X } from "lucide-react";
import { formatDuration, formatPence } from "@leadgen/core/booking/config";
import { localDate } from "@leadgen/core/booking/time";
import {
  accessRowsOf,
  BOOKING_STATUS,
  BOOKING_STATUS_TONE,
  DEPOSIT_STATUS,
  quoteOf,
  SIZE_NAME,
} from "@/lib/booking-display";
import { ApprovalActions } from "@/components/dashboard/approval-actions";
import { ConditionNote } from "@/components/dashboard/condition-note";
import { clock, longDate } from "@/lib/diary-display";
import { cn } from "@/lib/utils";
import { JobActions } from "./job-actions";
import { appUrl } from "@/lib/urls";

export type PanelJob = {
  id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  location_type: "mobile" | "unit";
  address_line: string | null;
  postcode: string;
  access_notes: Record<string, unknown> | null;
  customer_notes: string | null;
  quote_snapshot: unknown;
  price_pence: number;
  deposit_pence: number;
  deposit_status: string;
  customer: { id: string; name: string; email: string | null; phone: string | null } | null;
  // Which van or bay has it; shown when the business has more than one.
  resourceName?: string | null;
  service: { name: string } | null;
  vehicle: { make: string | null; model: string | null; registration: string | null; size_class: string | null } | null;
};

// The job picked in the diary: who, where, what and how much, with the few
// things an owner does on the day (done, no-show, cancel) one click away.
export function JobPanel({
  job: b,
  slug,
  timeZone,
  closeHref,
  setStatus,
  canManage,
}: {
  job: PanelJob;
  slug: string;
  timeZone: string;
  closeHref: string;
  setStatus: (next: string) => Promise<{ error?: string }>;
  // Approving, cancelling and putting back jobs (not technicians).
  canManage: boolean;
}) {
  const quote = quoteOf(b.quote_snapshot);
  const access = accessRowsOf(b.access_notes);
  const car = [b.vehicle?.make, b.vehicle?.model].filter(Boolean).join(" ");
  const address = [b.address_line, b.postcode].filter(Boolean).join(", ");
  const minutes = Math.round((new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime()) / 60_000);

  return (
    <section id="job" className="mt-4 scroll-mt-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{b.service?.name ?? "Booking"}</h2>
          <p className="text-sm text-muted-foreground">
            {longDate(localDate(new Date(b.starts_at), timeZone))}, {clock(b.starts_at, timeZone)} to{" "}
            {clock(b.ends_at, timeZone)} · {formatDuration(minutes)}
            {b.resourceName && <> · {b.resourceName}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium",
              BOOKING_STATUS_TONE[b.status] ?? "bg-muted",
            )}
          >
            {BOOKING_STATUS[b.status] ?? b.status}
          </span>
          <Link
            href={closeHref}
            aria-label="Close"
            className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </Link>
        </div>
      </header>

      <div className="grid gap-x-8 gap-y-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <Section title="Customer">
          {b.customer ? (
            <>
              <Link
                href={appUrl(`/${slug}/customers/${b.customer.id}`)}
                className="w-fit font-medium underline-offset-4 hover:underline"
              >
                {b.customer.name}
              </Link>
              {b.customer.phone && (
                <a href={`tel:${b.customer.phone}`} className="flex w-fit items-center gap-2 hover:underline">
                  <Phone className="size-3.5 text-muted-foreground" />
                  {b.customer.phone}
                </a>
              )}
              {b.customer.email && (
                <a href={`mailto:${b.customer.email}`} className="flex w-fit items-center gap-2 break-all hover:underline">
                  <Mail className="size-3.5 shrink-0 text-muted-foreground" />
                  {b.customer.email}
                </a>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">No customer on this booking.</p>
          )}
        </Section>

        <Section title="Where">
          {b.location_type === "unit" ? (
            <p>Drop-off at your unit</p>
          ) : (
            <>
              <p>{address}</p>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-fit items-center gap-1.5 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                <MapPin className="size-3.5" />
                Open in Maps
              </a>
            </>
          )}
          {access.map(([label, value]) => (
            <p key={label}>
              <span className="text-muted-foreground">{label}: </span>
              {value}
            </p>
          ))}
        </Section>

        <Section title="Vehicle">
          {car || b.vehicle?.registration ? (
            <>
              {car && <p className="font-medium">{car}</p>}
              {b.vehicle?.registration && <p className="font-mono">{b.vehicle.registration}</p>}
              {b.vehicle?.size_class && (
                <p className="text-muted-foreground">{SIZE_NAME[b.vehicle.size_class] ?? b.vehicle.size_class} size</p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">Not recorded.</p>
          )}
        </Section>

        <Section title="Price">
          <p className="font-medium">{formatPence(b.price_pence)}</p>
          <p className="text-muted-foreground">
            {DEPOSIT_STATUS[b.deposit_status] ?? b.deposit_status}
            {b.deposit_pence > 0 && ` · ${formatPence(b.deposit_pence)}`}
          </p>
          {quote && <ConditionNote condition={quote.condition} needsInspection={quote.needsInspection} size="xs" />}
        </Section>

        <Section title="Customer's notes" className="sm:col-span-1 lg:col-span-2">
          {b.customer_notes ? (
            <p className="whitespace-pre-wrap">{b.customer_notes}</p>
          ) : (
            <p className="text-muted-foreground">None.</p>
          )}
        </Section>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        {b.status === "requested" && canManage && (
          <ApprovalActions
            slug={slug}
            bookingId={b.id}
            customer={b.customer?.name ?? "this customer"}
            depositPaid={b.deposit_status === "paid"}
          />
        )}
        <JobActions
          status={b.status}
          depositPaid={b.deposit_status === "paid"}
          customer={b.customer?.name ?? "this customer"}
          action={setStatus}
          canManage={canManage}
        />
        <Link
          href={appUrl(`/${slug}/bookings/${b.id}`)}
          className="text-sm font-medium underline-offset-4 hover:underline"
        >
          Open the full booking{b.deposit_status === "paid" ? " (payments, refunds)" : ""} →
        </Link>
      </div>
    </section>
  );
}

function Section({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid content-start gap-1", className)}>
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
      {children}
    </div>
  );
}
