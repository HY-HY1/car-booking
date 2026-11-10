import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { formatDuration, formatPence } from "@leadgen/core/booking/config";
import { canMoveJob } from "@leadgen/core/booking/diary";
import { depositOwed } from "@leadgen/core/booking/manage-rules";
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
import { DepositRequestButton } from "@/components/dashboard/deposit-request-button";
import { PhotoThumbs } from "@/components/dashboard/photo-thumbs";
import { Badge } from "@/components/ui/badge";
import { clock, longDate } from "@/lib/diary-display";
import type { Photo } from "@/lib/photos";
import { appUrl } from "@/lib/urls";
import { cn } from "@/lib/utils";
import { ContactActions } from "./contact-actions";
import type { MoveJob } from "./diary-grid";
import { JobActions, type RefundOffer } from "./job-actions";
import { JobSheet } from "./job-sheet";
import { MoveJobForm } from "./move-job-form";

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
  internal_notes: string | null;
  staff: { name: string } | null;
  quote_snapshot: unknown;
  price_pence: number;
  deposit_pence: number;
  deposit_status: string;
  stripe_payment_intent_id: string | null;
  customer: { id: string; name: string; email: string | null; phone: string | null } | null;
  // Which van or bay has it; shown when the business has more than one.
  resourceName?: string | null;
  resource_id: string;
  service: { name: string } | null;
  vehicle: { make: string | null; model: string | null; registration: string | null; size_class: string | null } | null;
};

// The job picked in the diary: who, where, what and how much, with the few
// things an owner does on the day one tap away.
export function JobPanel({
  job: b,
  slug,
  timeZone,
  closeHref,
  setStatus,
  canManage,
  calendarNote,
  depositBlocked,
  photos,
  move,
  moveResources,
  refund,
}: {
  job: PanelJob;
  slug: string;
  timeZone: string;
  closeHref: string;
  setStatus: (next: string, refundPence?: number) => Promise<{ error?: string; warning?: string }>;
  // Approving, cancelling and putting back jobs (not technicians).
  canManage: boolean;
  // Something to know about this job's Google Calendar event.
  calendarNote?: string | null;
  // Why a deposit request can't be emailed (e.g. Stripe not connected).
  depositBlocked?: string;
  photos: Photo[];
  move: MoveJob;
  // The vans and bays this job could go on.
  moveResources: { id: string; name: string }[];
  // Set when the deposit can be given back while cancelling.
  refund?: RefundOffer;
}) {
  const quote = quoteOf(b.quote_snapshot);
  const access = accessRowsOf(b.access_notes);
  const car = [b.vehicle?.make, b.vehicle?.model].filter(Boolean).join(" ");
  const address = [b.address_line, b.postcode].filter(Boolean).join(", ");
  const minutes = Math.round((new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime()) / 60_000);
  const date = localDate(new Date(b.starts_at), timeZone);
  const customer = b.customer?.name ?? "this customer";

  return (
    <JobSheet
      jobId={b.id}
      title={b.service?.name ?? "Booking"}
      subtitle={`${longDate(date)}, ${clock(b.starts_at, timeZone)} to ${clock(b.ends_at, timeZone)} · ${formatDuration(minutes)}${b.resourceName ? ` · ${b.resourceName}` : ""}`}
      status={<Badge tone={BOOKING_STATUS_TONE[b.status]}>{BOOKING_STATUS[b.status] ?? b.status}</Badge>}
      closeHref={closeHref}
      footer={
        <>
          {b.status === "requested" && canManage && (
            <ApprovalActions slug={slug} bookingId={b.id} customer={customer} depositPaid={b.deposit_status === "paid"} />
          )}
          <JobActions
            status={b.status}
            depositPaid={b.deposit_status === "paid"}
            customer={customer}
            action={setStatus}
            canManage={canManage}
            refund={refund}
          />
          {canManage &&
            depositOwed({ status: b.status, depositPence: b.deposit_pence, depositStatus: b.deposit_status }) && (
              <DepositRequestButton
                slug={slug}
                bookingId={b.id}
                depositPence={b.deposit_pence}
                customerEmail={b.customer?.email ?? null}
                blockedReason={depositBlocked}
              />
            )}
          <Link
            href={appUrl(`/${slug}/bookings/${b.id}`)}
            className="w-full text-sm font-medium underline-offset-4 hover:underline"
          >
            Open the full booking →
          </Link>
        </>
      }
    >
      <div className="grid gap-5 text-sm">
        <ContactActions phone={b.customer?.phone ?? null} address={address} locationType={b.location_type} />

        {canManage && canMoveJob(b.status) && (
          <MoveJobForm
            key={b.id}
            bookingId={b.id}
            date={date}
            time={clock(b.starts_at, timeZone)}
            resourceId={b.resource_id}
            resources={moveResources}
            canEmail={Boolean(b.customer?.email)}
            customer={customer}
            move={move}
          />
        )}

        {calendarNote && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-950 dark:bg-amber-950/60 dark:text-amber-100">
            {calendarNote}
          </p>
        )}

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
          <p>{b.location_type === "unit" ? "Drop-off at your unit" : address}</p>
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

        {photos.length > 0 && (
          <Section title="Photos">
            <PhotoThumbs photos={photos} />
          </Section>
        )}

        <Section title="Price">
          <p className="font-medium">{formatPence(b.price_pence)}</p>
          <p className="text-muted-foreground">
            {DEPOSIT_STATUS[b.deposit_status] ?? b.deposit_status}
            {b.deposit_pence > 0 && ` · ${formatPence(b.deposit_pence)}`}
          </p>
          {quote && <ConditionNote condition={quote.condition} needsInspection={quote.needsInspection} size="xs" />}
        </Section>

        {b.staff && (
          <Section title="Who's doing it">
            <p>{b.staff.name}</p>
          </Section>
        )}

        {b.internal_notes && (
          <Section title="Team notes">
            <p className="whitespace-pre-wrap">{b.internal_notes}</p>
          </Section>
        )}

        <Section title="Customer's notes">
          {b.customer_notes ? (
            <p className="whitespace-pre-wrap">{b.customer_notes}</p>
          ) : (
            <p className="text-muted-foreground">None.</p>
          )}
        </Section>
      </div>
    </JobSheet>
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
