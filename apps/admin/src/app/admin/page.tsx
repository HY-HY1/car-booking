import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, CircleCheck } from "lucide-react";
import { formatShortDate } from "@leadgen/core/dates";
import { getPlatformOverview } from "@leadgen/core/platform/overview";
import { PLAN_GROUP_LABELS, type AttentionKind, type PlanGroup } from "@leadgen/core/platform/overview-rules";
import { BarChart } from "@/components/dashboard/overview/bar-chart";
import { Panel } from "@/components/dashboard/overview/panel";
import { StatTile } from "@/components/dashboard/overview/stat-tile";
import { PageHeader } from "@/components/dashboard/page-header";
import { ActivityList } from "@/components/platform/activity-list";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePlatformAdmin } from "@/lib/platform";
import { gbp, plan } from "@/lib/platform-format";
import { adminUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Platform overview" };

const KIND_LABEL: Record<AttentionKind, string> = {
  payment_failed: "Payment",
  closure_due: "Delete now",
  closure_requested: "Closing",
  data_request_overdue: "Privacy",
  trial_ending: "Trial",
  calendar_reconnect: "Calendar",
  webhook_failing: "Webhook",
  email_failures: "Email",
  stripe_unfinished: "Stripe",
  domain_unverified: "Domain",
};

const PLAN_ORDER: PlanGroup[] = ["paying", "trial", "problem", "signup", "manual", "paused", "ended"];

export default function PlatformOverviewPage() {
  return (
    <>
      <PageHeader title="Overview" description="Every business on the platform: what they pay, how they're using it, and what needs you." />
      <Suspense fallback={<OverviewSkeleton />}>
        <Overview />
      </Suspense>
    </>
  );
}

function OverviewSkeleton() {
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

async function Overview() {
  await requirePlatformAdmin();
  const o = await getPlatformOverview();
  const vs = "the 30 days before";

  return (
    <div className="grid gap-6">
      <section aria-label="Headline numbers" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile
          label="Businesses"
          value={String(o.total)}
          note={`${o.plans.paying} paying · ${o.plans.trial} on trial${o.plans.manual ? ` · ${o.plans.manual} billed by hand` : ""}`}
        />
        <StatTile
          label="Monthly recurring revenue"
          value={o.mrr ? gbp(o.mrr.pence) : "—"}
          note={
            o.mrr
              ? `${o.mrr.paying} paying × ${o.mrr.priceLabel}, at list price`
              : "Couldn't read the subscription price from Stripe (System shows what's missing)"
          }
        />
        <StatTile label="New businesses, last 30 days" value={String(o.signups.current)} current={o.signups.current} previous={o.signups.previous} comparedWith={vs} />
        <StatTile label="Bookings made, last 30 days" value={String(o.bookings.current)} current={o.bookings.current} previous={o.bookings.previous} comparedWith={vs} />
        <StatTile
          label="Value booked, last 30 days"
          value={gbp(o.bookingValuePence.current)}
          note="Price of confirmed and completed bookings, across all businesses"
          current={o.bookingValuePence.current}
          previous={o.bookingValuePence.previous}
          comparedWith={vs}
        />
        <StatTile label="Enquiries, last 30 days" value={String(o.leads.current)} current={o.leads.current} previous={o.leads.previous} comparedWith={vs} />
      </section>
      {o.truncated && <p className="text-xs text-muted-foreground">There are more bookings than one read takes, so the booking numbers are at least these.</p>}

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Panel>
          <h2 className="mb-3 flex items-center gap-2 font-medium">
            Needs you
            {o.attention.length > 0 && <Badge tone={o.attention.some((a) => a.urgent) ? "danger" : "warning"}>{o.attention.length}</Badge>}
          </h2>
          {o.attention.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CircleCheck className="size-4 text-emerald-600" /> Nothing needs looking at.
            </p>
          ) : (
            <ul className="divide-y">
              {o.attention.slice(0, 15).map((a, i) => (
                <li key={i} className="flex items-start gap-3 py-2 text-sm first:pt-0 last:pb-0">
                  <Badge tone={a.urgent ? "danger" : "warning"} className="mt-0.5 min-w-20 justify-center">
                    {a.urgent && <AlertTriangle className="size-3" />}
                    {KIND_LABEL[a.kind]}
                  </Badge>
                  <div className="min-w-0">
                    <Link href={adminUrl(`/businesses/${a.tenant.slug}`)} className="font-medium underline-offset-4 hover:underline">
                      {a.tenant.name}
                    </Link>
                    <p className="text-muted-foreground">{a.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {o.attention.length > 15 && <p className="mt-2 text-xs text-muted-foreground">And {o.attention.length - 15} more.</p>}
        </Panel>

        <Panel>
          <h2 className="mb-3 font-medium">Plans</h2>
          <ul className="grid gap-1.5 text-sm">
            {PLAN_ORDER.filter((g) => o.plans[g] > 0).map((g) => (
              <li key={g}>
                <Link href={adminUrl(`/businesses?plan=${g}`)} className="flex items-center justify-between gap-3 rounded-md px-2 py-1 hover:bg-muted">
                  <span>{PLAN_GROUP_LABELS[g]}</span>
                  <span className="font-medium tabular-nums">{o.plans[g]}</span>
                </Link>
              </li>
            ))}
            {o.total === 0 && <li className="text-muted-foreground">No businesses yet.</li>}
          </ul>
          {o.awaitingCard > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">Sign-ups with no card are removed automatically after 7 days if they have no bookings.</p>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <BarChart title="New businesses a week" kind="count" emptyText="No sign-ups in the last 12 weeks" data={o.weeks.map((w) => ({ label: w.label, fullLabel: w.fullLabel, value: w.signups }))} />
        </Panel>
        <Panel>
          <BarChart title="Bookings made a week" kind="count" emptyText="No bookings in the last 12 weeks" data={o.weeks.map((w) => ({ label: w.label, fullLabel: w.fullLabel, value: w.bookings }))} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <Panel>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-medium">Newest businesses</h2>
            <Link href={adminUrl("/businesses")} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
              All
            </Link>
          </div>
          {o.recentSignups.length === 0 ? (
            <EmptyState compact>None yet.</EmptyState>
          ) : (
            <ul className="divide-y">
              {o.recentSignups.map((t) => {
                const p = plan(t.status);
                return (
                  <li key={t.slug} className="flex items-center justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <Link href={adminUrl(`/businesses/${t.slug}`)} className="block truncate font-medium underline-offset-4 hover:underline">
                        {t.name}
                      </Link>
                      <span className="text-xs text-muted-foreground">Added {formatShortDate(t.createdAt)}</span>
                    </div>
                    <Badge tone={p.tone}>{p.label}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        <Panel>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-medium">Latest activity</h2>
            <Link href={adminUrl("/activity")} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
              All
            </Link>
          </div>
          <ActivityList rows={o.recentActivity} />
        </Panel>
      </div>
    </div>
  );
}
