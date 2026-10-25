import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { hasAccess, TRIAL_DAYS } from "@leadgen/core/billing/rules";
import { getBillingState, reconcileSubscription } from "@leadgen/core/billing/subscriptions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMemberships, requireUser } from "@/lib/auth";
import { signOut } from "@/app/app/actions";
import { startCheckoutAction } from "./actions";
import { appUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Start your trial" };

export default function BillingPage({ searchParams }: PageProps<"/app/signup/billing">) {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <Billing searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Billing({ searchParams }: { searchParams: PageProps<"/app/signup/billing">["searchParams"] }) {
  const sp = await searchParams;
  const slug = typeof sp.tenant === "string" ? sp.tenant : "";
  await requireUser(appUrl(`/signup/billing?tenant=${encodeURIComponent(slug)}`));
  const membership = (await getMemberships()).find((m) => m.tenant.slug === slug);
  if (!membership) notFound();
  if (hasAccess(membership.tenant.subscription_status)) redirect(appUrl(`/${slug}`));

  // Paid but never recorded (the return page wasn't reached, or the webhook
  // wasn't running)? Ask Stripe, and if they're subscribed take them straight
  // to their own page rather than ask them to pay again.
  let recovered = false;
  try {
    const status = await reconcileSubscription(membership.tenant.id);
    recovered = status !== null && hasAccess(status);
  } catch (error) {
    console.error("Couldn't check Stripe for an existing subscription", error);
  }
  if (recovered) redirect(appUrl(`/${membership.tenant.slug}/setup`));

  const isOwner = membership.role === "owner";
  const billing = await getBillingState(membership.tenant.id);
  // A subscription id means they've been through Checkout before, so this is a
  // return, not a first start (and there is no second trial).
  const returning = Boolean(billing.subscriptionId);

  const note = sp.error
    ? "We couldn't reach Stripe just now. Nothing has been charged. Please try again."
    : sp.cancelled
      ? "No problem. You haven't been charged. Pick up where you left off whenever you're ready."
      : null;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>
          {returning ? "Your subscription has ended" : `Start your ${TRIAL_DAYS}-day free trial`}
        </CardTitle>
        <CardDescription>
          {returning
            ? `Subscribe again to get back into ${membership.tenant.name}. Your bookings, customers and settings are all still here.`
            : `${membership.tenant.name} is set up. Add a card on Stripe to start your trial. You won't be charged until it ends, and you can cancel before then.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {note && (
          <p role="status" className="text-sm text-muted-foreground">
            {note}
          </p>
        )}
        {isOwner ? (
          <form action={startCheckoutAction.bind(null, slug)}>
            <Button type="submit" size="lg" className="w-full">
              {returning ? "Subscribe" : "Continue to Stripe"}
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">Ask the business owner to start the subscription.</p>
        )}
        <form action={signOut}>
          <Button type="submit" variant="ghost" className="w-full">
            Sign out
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
