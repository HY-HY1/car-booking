import Link from "next/link";
import { formatPence } from "@leadgen/core/booking/config";
import { formatDayTime, formatShortDate, formatTime } from "@leadgen/core/dates";
import type { Today, TodayJob } from "@leadgen/core/stats/today";
import { Badge } from "@/components/ui/badge";
import { BOOKING_STATUS, BOOKING_STATUS_TONE } from "@/lib/booking-display";
import { appUrl } from "@/lib/urls";
import { Panel } from "./panel";

const moreLink = "text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline";

export function TodaysJobs({ slug, jobs, timeZone }: { slug: string; jobs: TodayJob[]; timeZone: string }) {
  return (
    <Panel>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium">Today&apos;s jobs</h2>
        <Link href={appUrl(`/${slug}/diary?view=day`)} className={moreLink}>
          Open diary
        </Link>
      </div>
      {jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing booked today.</p>
      ) : (
        <ul className="divide-y">
          {jobs.map((j) => (
            <li key={j.id}>
              <Link href={appUrl(`/${slug}/bookings/${j.id}`)} className="flex items-center justify-between gap-3 py-2 text-sm hover:bg-muted/40">
                <span className="min-w-0">
                  <span className="block font-medium">
                    {formatTime(j.startsAt, timeZone)} to {formatTime(j.endsAt, timeZone)}
                  </span>
                  <span className="block truncate text-muted-foreground">
                    {[j.service, j.customer, j.postcode].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {j.status !== "confirmed" && <Badge tone={BOOKING_STATUS_TONE[j.status]}>{BOOKING_STATUS[j.status] ?? j.status}</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Group({
  title,
  total,
  shown,
  allHref,
  children,
}: {
  title: string;
  total: number;
  shown: number;
  allHref: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {title}
        <Badge>{total}</Badge>
      </h3>
      <ul className="mt-1 divide-y">{children}</ul>
      {total > shown && (
        <Link href={allHref} className={`${moreLink} mt-1 inline-block`}>
          See all {total}
        </Link>
      )}
    </div>
  );
}

function Row({ href, main, sub, side }: { href: string; main: string; sub: string; side?: string }) {
  return (
    <li>
      <Link href={href} className="flex items-center justify-between gap-3 py-2 text-sm hover:bg-muted/40">
        <span className="min-w-0">
          <span className="block truncate font-medium">{main}</span>
          <span className="block truncate text-muted-foreground">{sub}</span>
        </span>
        {side && <span className="shrink-0 text-muted-foreground">{side}</span>}
      </Link>
    </li>
  );
}

export function NeedsAttention({ slug, today }: { slug: string; today: Today }) {
  const { approvals, unpaid, leads, timezone } = today;
  const bookingHref = (id: string) => appUrl(`/${slug}/bookings/${id}`);
  const nothing = !approvals?.total && !unpaid?.total && !leads?.total;

  return (
    <Panel>
      <h2 className="mb-3 text-sm font-medium">Needs attention</h2>
      {nothing ? (
        <p className="text-sm text-muted-foreground">You&apos;re all caught up.</p>
      ) : (
        <div className="grid gap-4">
          {approvals && approvals.total > 0 && (
            <Group title="Waiting for approval" total={approvals.total} shown={approvals.rows.length} allHref={appUrl(`/${slug}/bookings`)}>
              {approvals.rows.map((b) => (
                <Row
                  key={b.id}
                  href={bookingHref(b.id)}
                  main={b.customer ?? "Customer"}
                  sub={[b.service, formatDayTime(b.startsAt, timezone)].filter(Boolean).join(" · ")}
                />
              ))}
            </Group>
          )}
          {unpaid && unpaid.total > 0 && (
            <Group
              title={`Unpaid balances · ${formatPence(unpaid.totalPence)}`}
              total={unpaid.total}
              shown={unpaid.rows.length}
              allHref={appUrl(`/${slug}/bookings?view=past`)}
            >
              {unpaid.rows.map((b) => (
                <Row
                  key={b.id}
                  href={bookingHref(b.id)}
                  main={b.customer ?? "Customer"}
                  sub={[b.service, formatShortDate(b.startsAt, timezone)].filter(Boolean).join(" · ")}
                  side={formatPence(b.balancePence)}
                />
              ))}
            </Group>
          )}
          {leads && leads.total > 0 && (
            <Group title="New leads this week" total={leads.total} shown={leads.rows.length} allHref={appUrl(`/${slug}/leads`)}>
              {leads.rows.map((l) => (
                <Row
                  key={l.id}
                  href={appUrl(`/${slug}/leads/${l.id}`)}
                  main={l.customer ?? "Customer"}
                  sub={[l.service, l.quotePence != null && formatPence(l.quotePence)].filter(Boolean).join(" · ") || "No quote yet"}
                  side={formatShortDate(l.createdAt, timezone)}
                />
              ))}
            </Group>
          )}
        </div>
      )}
    </Panel>
  );
}
