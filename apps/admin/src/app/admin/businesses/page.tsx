import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { formatDate, formatShortDate } from "@leadgen/core/dates";
import { timeToFirstEnquiry } from "@leadgen/core/onboarding/milestones";
import { listBusinesses, type BusinessSummary } from "@leadgen/core/platform/businesses";
import { PLAN_GROUP_LABELS, planGroup, type PlanGroup } from "@leadgen/core/platform/overview-rules";
import { isCustomHostname } from "@leadgen/core/tenants";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { requirePlatformAdmin } from "@/lib/platform";
import { ago, plan } from "@/lib/platform-format";
import { adminUrl, tenantUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Businesses" };

const STRIPE: Record<BusinessSummary["stripe"], { label: string; tone: "success" | "warning" | "neutral" }> = {
  connected: { label: "Connected", tone: "success" },
  pending: { label: "Unfinished", tone: "warning" },
  none: { label: "Not connected", tone: "neutral" },
};

const SORTS = {
  newest: "Newest first",
  name: "Name",
  busiest: "Most bookings, last 30 days",
  quiet: "Longest since a booking",
} as const;
type Sort = keyof typeof SORTS;

const PLAN_GROUPS = Object.keys(PLAN_GROUP_LABELS) as PlanGroup[];

type Filters = { q: string; plan: PlanGroup | ""; stripe: BusinessSummary["stripe"] | ""; closing: boolean; sort: Sort };

function parseFilters(sp: Record<string, string | string[] | undefined>): Filters {
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const planValue = str("plan");
  const stripeValue = str("stripe");
  const sortValue = str("sort");
  return {
    q: str("q").slice(0, 100),
    plan: PLAN_GROUPS.includes(planValue as PlanGroup) ? (planValue as PlanGroup) : "",
    stripe: stripeValue in STRIPE ? (stripeValue as BusinessSummary["stripe"]) : "",
    closing: str("closing") === "1",
    sort: sortValue in SORTS ? (sortValue as Sort) : "newest",
  };
}

function apply(businesses: BusinessSummary[], f: Filters) {
  const q = f.q.toLowerCase();
  const out = businesses.filter(
    (b) =>
      (!q ||
        b.name.toLowerCase().includes(q) ||
        b.slug.includes(q) ||
        b.members.some((m) => m.email.toLowerCase().includes(q)) ||
        b.domains.some((d) => d.hostname.includes(q))) &&
      (!f.plan || planGroup(b.subscriptionStatus) === f.plan) &&
      (!f.stripe || b.stripe === f.stripe) &&
      (!f.closing || b.deletionRequestedAt),
  );
  const time = (iso: string | null) => (iso ? Date.parse(iso) : 0);
  switch (f.sort) {
    case "name":
      return out.sort((a, b) => a.name.localeCompare(b.name));
    case "busiest":
      return out.sort((a, b) => b.bookings30 - a.bookings30 || b.bookings - a.bookings);
    case "quiet":
      return out.sort((a, b) => time(a.lastBookingAt) - time(b.lastBookingAt));
    default:
      return out;
  }
}

export default function BusinessesPage({ searchParams }: PageProps<"/admin/businesses">) {
  return (
    <>
      <PageHeader title="Businesses" />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <Businesses searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Businesses({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePlatformAdmin(adminUrl("/businesses"));
  const [all, sp] = await Promise.all([listBusinesses(), searchParams]);
  const f = parseFilters(sp);
  const shown = apply(all, f);
  const filtered = Boolean(f.q || f.plan || f.stripe || f.closing);
  const deleted = typeof sp.deleted === "string" ? sp.deleted.slice(0, 100) : null;
  const notice = deleted && (
    <p role="status" className="rounded-xl border bg-muted/40 px-4 py-3 text-sm">
      Deleted {deleted} and everything under it.
    </p>
  );

  if (all.length === 0) {
    return (
      <div className="grid gap-4">
        {notice}
        <EmptyState>
        No businesses yet.{" "}
        <Link href={adminUrl("/new")} className="underline underline-offset-4">
          Add the first one
        </Link>
        .
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {notice}
      <form method="get" className="flex flex-wrap items-end gap-2" role="search">
        <div className="grid min-w-56 flex-1 gap-1.5">
          <label htmlFor="q" className="text-sm font-medium">
            Search
          </label>
          <Input id="q" name="q" defaultValue={f.q} placeholder="Name, dashboard ID, owner email or domain" />
        </div>
        <Select name="plan" defaultValue={f.plan} aria-label="Plan" className="w-44">
          <option value="">Any plan</option>
          {PLAN_GROUPS.map((g) => (
            <option key={g} value={g}>
              {PLAN_GROUP_LABELS[g]}
            </option>
          ))}
        </Select>
        <Select name="stripe" defaultValue={f.stripe} aria-label="Stripe" className="w-40">
          <option value="">Any Stripe</option>
          <option value="connected">Stripe connected</option>
          <option value="pending">Stripe unfinished</option>
          <option value="none">No Stripe</option>
        </Select>
        <Select name="sort" defaultValue={f.sort} aria-label="Sort" className="w-52">
          {Object.entries(SORTS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <label className="flex h-9 items-center gap-2 text-sm">
          <input type="checkbox" name="closing" value="1" defaultChecked={f.closing} className="size-4" />
          Closing only
        </label>
        <Button type="submit" variant="outline">
          Filter
        </Button>
        {filtered && (
          <Link href={adminUrl("/businesses")} className={buttonVariants({ variant: "ghost" })}>
            Clear
          </Link>
        )}
      </form>

      <p className="text-sm text-muted-foreground">
        {filtered ? `${shown.length} of ${all.length}` : all.length} {all.length === 1 ? "business" : "businesses"}
      </p>

      {shown.length === 0 ? (
        <EmptyState compact>Nothing matches those filters.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Business</th>
                <th className="px-4 py-2 font-medium">Plan</th>
                <th className="px-4 py-2 font-medium">Owners</th>
                <th className="px-4 py-2 font-medium">Stripe</th>
                <th className="px-4 py-2 text-right font-medium">Bookings</th>
                <th className="px-4 py-2 font-medium">Last booking</th>
                <th className="px-4 py-2 font-medium">First enquiry</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {shown.map((b) => {
                const primary = b.domains.find((d) => d.isPrimary && isCustomHostname(d.hostname));
                const owners = b.members.filter((m) => m.role === "owner");
                const p = plan(b.subscriptionStatus, b.trialEndsAt);
                return (
                  <tr key={b.id} className="align-top hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link href={adminUrl(`/businesses/${b.slug}`)} className="font-medium underline-offset-4 hover:underline">
                        {b.name}
                      </Link>
                      <span className="block font-mono text-xs text-muted-foreground">
                        {primary ? primary.hostname : tenantUrl(b.slug, "/", { absolute: true }).replace(/^https?:\/\//, "")}
                        {primary && !primary.verified && <span className="ml-1 text-amber-700 dark:text-amber-400">(unverified)</span>}
                      </span>
                      <span className="block text-xs text-muted-foreground">Added {formatDate(b.createdAt)}</span>
                      {b.deletionRequestedAt && (
                        <span className="mt-1 block text-xs font-medium text-destructive">Asked to close {formatShortDate(b.deletionRequestedAt)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={p.tone}>{p.label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {owners.length ? owners.map((o) => <span key={o.userId} className="block">{o.email}</span>) : "—"}
                      {b.members.length > owners.length && (
                        <span className="block text-xs text-muted-foreground">+{b.members.length - owners.length} team</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={STRIPE[b.stripe].tone}>{STRIPE[b.stripe].label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {b.bookings}
                      <span className="block text-xs text-muted-foreground">{b.bookings30} in 30 days</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{b.lastBookingAt ? ago(b.lastBookingAt) : <span className="text-muted-foreground">None yet</span>}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {b.firstEnquiryAt ? (
                        <>
                          {timeToFirstEnquiry(b.createdAt, b.firstEnquiryAt)}
                          <span className="block text-xs text-muted-foreground">after being added</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">None yet</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
