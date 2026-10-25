import type { Metadata } from "next";
import { getBillingState, getSubscriptionDetails, type SubscriptionDetails } from "@leadgen/core/billing/subscriptions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAccess } from "@/lib/auth";
import { manageSubscriptionAction } from "./actions";

export const metadata: Metadata = { title: "Billing" };

const STATUS_LABELS: Record<string, string> = {
  trialing: "Free trial",
  active: "Active",
  past_due: "Payment overdue",
  canceled: "Cancelled",
  unpaid: "Unpaid",
  incomplete: "Incomplete",
  incomplete_expired: "Expired",
  awaiting_checkout: "Not started",
};

const date = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

export default async function BillingPage({
  params,
  searchParams,
}: PageProps<"/app/[tenant]/settings/billing">) {
  const { tenant: slug } = await params;
  const sp = await searchParams;
  const { tenant, can } = await requireAccess(slug, "settings.view");
  const billing = await getBillingState(tenant.id);

  let details: SubscriptionDetails | null = null;
  if (billing.subscriptionId) {
    try {
      details = await getSubscriptionDetails(billing.subscriptionId);
    } catch (error) {
      console.error("Couldn't load the subscription from Stripe", error);
    }
  }

  const isOwner = can("billing");

  // null: not billed through the app (set up by hand), so nothing to manage.
  if (billing.status === null) {
    return (
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Your plan</CardTitle>
          <CardDescription>Your account isn&apos;t billed through the app, so there&apos;s nothing to manage here.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const trialEnd = billing.trialEndsAt ?? (billing.status === "trialing" ? details?.periodEnd : null);
  const rows: [string, string][] = [
    ["Status", STATUS_LABELS[billing.status] ?? billing.status],
  ];
  if (details?.priceLabel) rows.push(["Plan", details.priceLabel]);
  if (billing.status === "trialing" && trialEnd) rows.push(["Trial ends", date(trialEnd)]);
  if (details?.periodEnd && billing.status !== "trialing") {
    rows.push([details.cancelsAtPeriodEnd ? "Access until" : "Next payment", date(details.periodEnd)]);
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Your plan</CardTitle>
        <CardDescription>Your plan for using the software: what you pay us, not your customers&apos; payments.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {sp.error && (
          <p role="status" className="text-sm text-destructive">
            We couldn&apos;t reach Stripe just now. Please try again.
          </p>
        )}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {details?.cancelsAtPeriodEnd && (
          <p className="text-sm text-muted-foreground">
            Your subscription is set to cancel. You can resume it any time before then from Manage billing.
          </p>
        )}
        {billing.status === "past_due" && (
          <p className="text-sm text-muted-foreground">
            Your last payment didn&apos;t go through. Update your card to keep your access.
          </p>
        )}
        {isOwner ? (
          billing.customerId ? (
            <form action={manageSubscriptionAction.bind(null, slug)}>
              <Button type="submit">Manage billing</Button>
              <p className="mt-2 text-xs text-muted-foreground">
                Opens Stripe, where you can change plan, update your card, download invoices, or cancel.
              </p>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">No subscription has been started yet.</p>
          )
        ) : (
          <p className="text-sm text-muted-foreground">Ask the business owner to manage billing.</p>
        )}
      </CardContent>
    </Card>
  );
}
