import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { timeToFirstEnquiry } from "@leadgen/core/onboarding/milestones";
import { listBusinesses, type BusinessSummary } from "@leadgen/core/platform/businesses";
import { isCustomHostname } from "@leadgen/core/tenants";
import { PageHeader } from "@/components/dashboard/page-header";
import { requirePlatformAdmin } from "@/lib/platform";
import { adminUrl, tenantUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Businesses" };

const STRIPE: Record<BusinessSummary["stripe"], string> = {
  connected: "Connected",
  pending: "Setup unfinished",
  none: "Not connected",
};

// What the business pays us. No status means we bill them ourselves.
const PLAN: Record<string, string> = {
  awaiting_checkout: "Signed up, no card yet",
  active: "Paying",
  past_due: "Payment failed",
  canceled: "Cancelled",
  unpaid: "Unpaid",
  incomplete: "Incomplete",
  incomplete_expired: "Never started",
  paused: "Paused",
};

function planLabel(b: BusinessSummary) {
  if (!b.subscriptionStatus) return <span className="text-muted-foreground">Billed by hand</span>;
  if (b.subscriptionStatus === "trialing") {
    const ends = b.trialEndsAt
      ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(b.trialEndsAt))
      : null;
    return ends ? `Trial, ends ${ends}` : "Trial";
  }
  return PLAN[b.subscriptionStatus] ?? b.subscriptionStatus;
}

export default function PlatformPage() {
  return (
    <>
      <PageHeader title="Businesses" description="Every business on the platform. Add a new one to onboard it." />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <Businesses />
      </Suspense>
    </>
  );
}

async function Businesses() {
  await requirePlatformAdmin();
  const businesses = await listBusinesses();

  if (businesses.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        No businesses yet.{" "}
        <Link href={adminUrl("/new")} className="underline underline-offset-4">
          Add the first one
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-muted-foreground">
          <tr>
            <th className="px-4 py-2 font-medium">Business</th>
            <th className="px-4 py-2 font-medium">Booking address</th>
            <th className="px-4 py-2 font-medium">Owners</th>
            <th className="px-4 py-2 font-medium">Plan</th>
            <th className="px-4 py-2 font-medium">Stripe</th>
            <th className="px-4 py-2 font-medium">Bookings</th>
            <th className="px-4 py-2 font-medium">First enquiry</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {businesses.map((b) => {
            // Their own domain if they have one, else the free address every business gets.
            const primary = b.domains.find((d) => d.isPrimary && isCustomHostname(d.hostname));
            const owners = b.members.filter((m) => m.role === "owner");
            return (
              <tr key={b.id} className="align-top hover:bg-muted/30">
                <td className="px-4 py-3">
                  <Link href={adminUrl(`/${b.slug}`)} className="font-medium underline-offset-4 hover:underline">
                    {b.name}
                  </Link>
                  <span className="block font-mono text-xs text-muted-foreground">{b.slug}</span>
                  {b.deletionRequestedAt && (
                    <span className="mt-1 block text-xs font-medium text-destructive">
                      Asked to delete on{" "}
                      {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(
                        new Date(b.deletionRequestedAt),
                      )}
                      ; delete after 30 days
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {primary ? (
                    <>
                      <span className="font-mono text-xs">{primary.hostname}</span>
                      {!primary.verified && <span className="block text-xs text-amber-700">Not verified yet</span>}
                    </>
                  ) : (
                    <span className="font-mono text-xs text-muted-foreground">
                      {tenantUrl(b.slug, "/", { absolute: true }).replace(/^https?:\/\//, "")}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {owners.length ? owners.map((o) => <span key={o.userId} className="block">{o.email}</span>) : "—"}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{planLabel(b)}</td>
                <td className="px-4 py-3 whitespace-nowrap">{STRIPE[b.stripe]}</td>
                <td className="px-4 py-3">{b.bookings}</td>
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
  );
}
