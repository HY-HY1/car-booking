import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { formatPence } from "@leadgen/core/booking/config";
import { getOverview, type IncomeState } from "@leadgen/core/stats/overview";
import { parseOffset, parsePeriod } from "@leadgen/core/stats/periods";
import { DashboardSearch } from "@/components/dashboard/dashboard-search";
import { PageHeader } from "@/components/dashboard/page-header";
import { BarChart } from "@/components/dashboard/overview/bar-chart";
import { PeriodControls } from "@/components/dashboard/overview/period-controls";
import { SetupNudge } from "@/components/dashboard/setup-nudge";
import { StatTile } from "@/components/dashboard/overview/stat-tile";
import { requireTenant } from "@/lib/auth";
import { PAYMENT_SOURCE, PAYMENT_STATUS } from "@/lib/payment-labels";
import { cn } from "@/lib/utils";
import { appUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage({
  params,
  searchParams,
}: PageProps<"/app/[tenant]">) {
  const { tenant: slug } = await params;
  const { tenant, role, can } = await requireTenant(slug);
  const isOwner = can("money");
  const sp = await searchParams;
  const period = parsePeriod(sp.period);
  const offset = parseOffset(sp.n);

  // Income is money: owners and managers, as on the Payments tab.
  const o = await getOverview(tenant.id, period, offset, { includeIncome: isOwner });
  const income = o.income;
  const ok = income.state === "ok" ? income : null;
  const pounds = (pence: number) => formatPence(pence);

  return (
    <>
      <PageHeader title="Overview" description={`How ${tenant.name} is doing.`} />
      {can("customers.view") && <DashboardSearch slug={slug} role={role} />}
      {isOwner && (
        <Suspense>
          <SetupNudge tenantId={tenant.id} slug={slug} />
        </Suspense>
      )}
      <PeriodControls slug={slug} period={period} offset={offset} label={o.label} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        {ok ? (
          <StatTile
            label="Income"
            value={pounds(ok.current.incomePence)}
            note={`${pounds(ok.current.takeHomePence)} after Stripe fees · ${ok.current.payments} ${ok.current.payments === 1 ? "payment" : "payments"}`}
            current={ok.current.incomePence}
            previous={ok.previous.incomePence}
            comparedWith={o.compareLabel}
          />
        ) : (
          <StatTile label="Income" value="—" note={incomeMessage(income, slug).text} />
        )}
        <StatTile
          label="Jobs"
          value={String(o.jobs.value)}
          note="Booked for this period"
          current={o.jobs.value}
          previous={o.jobs.previous}
          comparedWith={o.previousLabel}
        />
        <StatTile
          label="Booked value"
          value={pounds(o.bookedValue.value)}
          note="Price of those jobs"
          current={o.bookedValue.value}
          previous={o.bookedValue.previous}
          comparedWith={o.previousLabel}
        />
        <StatTile
          label="New bookings"
          value={String(o.newBookings.value)}
          note="Made in this period"
          current={o.newBookings.value}
          previous={o.newBookings.previous}
          comparedWith={o.compareLabel}
        />
        <StatTile
          label="Leads"
          value={String(o.leads.value)}
          note={o.conversion.value === null ? "No leads yet" : `${o.conversion.value}% went on to book`}
          current={o.leads.value}
          previous={o.leads.previous}
          comparedWith={o.compareLabel}
        />
        <StatTile
          label="New customers"
          value={String(o.customers.value)}
          current={o.customers.value}
          previous={o.customers.previous}
          comparedWith={o.compareLabel}
        />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Panel>
          {income.state === "ok" ? (
            <>
              <BarChart
                title="Income"
                kind="money"
                data={o.buckets.map((b) => ({ label: b.label, fullLabel: b.fullLabel, value: b.incomePence ?? 0 }))}
                emptyText="No payments in this period."
              />
              {income.truncated && (
                <p className="mt-3 text-xs text-muted-foreground">
                  There are more payments than can be read at once, so these totals are a minimum. Narrow the period for exact figures.
                </p>
              )}
            </>
          ) : (
            <Empty title="Income" message={incomeMessage(income, slug)} />
          )}
        </Panel>
        <Panel>
          <BarChart
            title="Jobs"
            kind="count"
            data={o.buckets.map((b) => ({ label: b.label, fullLabel: b.fullLabel, value: b.jobs }))}
            emptyText="No jobs booked in this period."
          />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel>
          <h2 className="mb-3 text-sm font-medium">Next up</h2>
          {o.upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">No confirmed jobs coming up.</p>
          ) : (
            <ul className="divide-y">
              {o.upcoming.map((u) => (
                <li key={u.id}>
                  <Link href={appUrl(`/${slug}/bookings/${u.id}`)} className="grid gap-0.5 py-2 text-sm hover:bg-muted/40">
                    <span className="font-medium">{formatWhen(u.startsAt, o.timezone)}</span>
                    <span className="text-muted-foreground">{[u.service, u.customer].filter(Boolean).join(" · ")}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <h2 className="mb-3 text-sm font-medium">Top services</h2>
          {o.topServices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No jobs booked in this period.</p>
          ) : (
            <ul className="grid gap-2 text-sm">
              {o.topServices.map((s) => (
                <li key={s.name} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate">{s.name}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {s.jobs} {s.jobs === 1 ? "job" : "jobs"} · {pounds(s.valuePence)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <h2 className="mb-3 text-sm font-medium">{ok ? "Where income came from" : "Recent payments"}</h2>
          {ok ? (
            <>
              <ul className="grid gap-2 text-sm">
                {(["deposit", "payment_link", "other"] as const).map((src) => (
                  <li key={src} className="flex justify-between gap-3">
                    <span>{PAYMENT_SOURCE[src]}</span>
                    <span className="text-muted-foreground">{pounds(ok.bySource[src])}</span>
                  </li>
                ))}
              </ul>
              {ok.recent.length > 0 && (
                <ul className="mt-4 divide-y border-t">
                  {ok.recent.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate">{p.customerName ?? PAYMENT_SOURCE[p.source]}</span>
                        <span className="block text-xs text-muted-foreground">{formatWhen(p.createdAt, o.timezone)}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {pounds(p.amountPence)}
                        {p.status !== "paid" && (
                          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", PAYMENT_STATUS[p.status].tone)}>
                            {PAYMENT_STATUS[p.status].label}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Link href={appUrl(`/${slug}/payments`)} className="mt-3 inline-block text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                All payments
              </Link>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{incomeMessage(income, slug).text}</p>
          )}
        </Panel>
      </div>
    </>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">{children}</section>;
}

function Empty({ title, message }: { title: string; message: { text: string; href?: string; cta?: string } }) {
  return (
    <div className="grid gap-2">
      <h2 className="text-sm font-medium">{title}</h2>
      <p className="text-sm text-muted-foreground">
        {message.text}
        {message.href && (
          <>
            {" "}
            <Link href={message.href} className="underline underline-offset-4">
              {message.cta}
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

function incomeMessage(income: IncomeState, slug: string): { text: string; href?: string; cta?: string } {
  if (income.state === "hidden") return { text: "Income is only visible to the business owner." };
  if (income.state === "not_connected") {
    return { text: "Connect Stripe to see income here.", href: appUrl(`/${slug}/settings/payments`), cta: "Open Settings" };
  }
  if (income.state === "error") return { text: "Couldn't load income from Stripe just now. Reload to try again." };
  return { text: "" };
}

function formatWhen(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(iso));
}
