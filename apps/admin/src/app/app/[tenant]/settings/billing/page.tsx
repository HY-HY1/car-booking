import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { getBillingState, getSubscriptionDetails, type SubscriptionDetails } from "@leadgen/core/billing/subscriptions";
import { formatDate } from "@leadgen/core/dates";
import { SettingsSection, SettingsStack } from "@/components/dashboard/settings/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireAccess } from "@/lib/auth";
import { manageSubscriptionAction } from "./actions";

export const metadata: Metadata = { title: "Billing" };

const STATUS: Record<string, { label: string; tone: "success" | "warning" | "danger" | "neutral" | "info" }> = {
  trialing: { label: "Free trial", tone: "info" },
  active: { label: "Active", tone: "success" },
  past_due: { label: "Payment overdue", tone: "danger" },
  canceled: { label: "Cancelled", tone: "neutral" },
  unpaid: { label: "Unpaid", tone: "danger" },
  incomplete: { label: "Incomplete", tone: "warning" },
  incomplete_expired: { label: "Expired", tone: "neutral" },
  awaiting_checkout: { label: "Not started", tone: "neutral" },
};

// The business's own plan for this software. Owners only: managers and
// office staff don't see what the business pays.
export default async function BillingPage({ params, searchParams }: PageProps<"/app/[tenant]/settings/billing">) {
  const { tenant: slug } = await params;
  const sp = await searchParams;
  const { tenant } = await requireAccess(slug, "billing");
  const billing = await getBillingState(tenant.id);

  let details: SubscriptionDetails | null = null;
  if (billing.subscriptionId) {
    try {
      details = await getSubscriptionDetails(billing.subscriptionId);
    } catch (error) {
      console.error("Couldn't load the subscription from Stripe", error);
    }
  }

  // null: not billed through the app (set up by hand), so nothing to manage.
  if (billing.status === null) {
    return (
      <SettingsStack>
        <SettingsSection id="plan" title="Your plan" description="What you pay us for the software, not your customers' payments.">
          <p className="text-muted-foreground">Your account isn&apos;t billed through the app, so there&apos;s nothing to manage here.</p>
        </SettingsSection>
      </SettingsStack>
    );
  }

  const status = STATUS[billing.status] ?? { label: billing.status, tone: "neutral" as const };
  const trialEnd = billing.trialEndsAt ?? (billing.status === "trialing" ? details?.periodEnd : null);
  const rows: [string, string][] = [];
  if (details?.priceLabel) rows.push(["Plan", details.priceLabel]);
  if (billing.status === "trialing" && trialEnd) rows.push(["Trial ends", formatDate(trialEnd)]);
  if (details?.periodEnd && billing.status !== "trialing") {
    rows.push([details.cancelsAtPeriodEnd ? "Access until" : "Next payment", formatDate(details.periodEnd)]);
  }

  return (
    <SettingsStack>
      <SettingsSection
        id="plan"
        title="Your plan"
        badge={<Badge tone={status.tone}>{status.label}</Badge>}
        description="What you pay us for the software, not your customers' payments."
      >
        <div className="grid gap-5">
          {sp.error && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive">
              We couldn&apos;t reach Stripe just now. Please try again.
            </p>
          )}
          {billing.status === "past_due" && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              Your last payment didn&apos;t go through. Update your card to keep your access.
            </p>
          )}
          {rows.length > 0 && (
            <dl className="grid gap-3 @md:grid-cols-2">
              {rows.map(([label, value]) => (
                <div key={label} className="rounded-lg bg-muted/50 p-4">
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="text-lg font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {details?.cancelsAtPeriodEnd && (
            <p className="text-muted-foreground">Your subscription is set to cancel. You can resume it any time before then from Manage billing.</p>
          )}
          {billing.customerId ? (
            <form action={manageSubscriptionAction.bind(null, slug)} className="grid gap-2">
              <Button type="submit" size="lg" className="justify-self-start">
                Manage billing <ExternalLink />
              </Button>
              <p className="text-muted-foreground">Opens Stripe, where you can change plan, update your card, download invoices, or cancel.</p>
            </form>
          ) : (
            <p className="text-muted-foreground">No subscription has been started yet.</p>
          )}
        </div>
      </SettingsSection>
    </SettingsStack>
  );
}
