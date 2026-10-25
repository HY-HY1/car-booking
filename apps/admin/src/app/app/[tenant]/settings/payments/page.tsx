import type { Metadata } from "next";
import Link from "next/link";
import { bookingSettingsSchema } from "@leadgen/core/booking/config";
import { policyOf } from "@leadgen/core/settings/policy";
import { syncAccountStatus } from "@leadgen/core/stripe/accounts";
import { DepositForm, RefundForm } from "@/components/dashboard/settings/payment-forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { connectStripeAction } from "../actions";
import { saveDepositAction, saveRefundRulesAction } from "./actions";
import { appUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Payments settings" };

export default async function PaymentsSettingsPage({
  params,
  searchParams,
}: PageProps<"/app/[tenant]/settings/payments">) {
  const { tenant: slug } = await params;
  const returnedFromStripe = (await searchParams).stripe === "return";
  const { tenant, can } = await requireAccess(slug, "settings.view");
  const canEdit = can("settings.edit");

  const supabase = await createClient();
  const [payments, settingsRow] = await Promise.all([
    supabase.from("tenants").select("stripe_account_id, stripe_ready").eq("id", tenant.id).single(),
    supabase.from("booking_settings").select("*").eq("tenant_id", tenant.id).maybeSingle(),
  ]);
  if (payments.error) throw payments.error;
  if (settingsRow.error) throw settingsRow.error;

  // Coming back from Stripe's onboarding, or still waiting on it: ask Stripe
  // directly rather than wait for the webhook. A Stripe hiccup shouldn't take
  // the page down, so this falls back to what's stored.
  let stripeReady = payments.data.stripe_ready;
  const stripeAccountId = payments.data.stripe_account_id;
  if (stripeAccountId && (returnedFromStripe || !stripeReady)) {
    try {
      stripeReady = (await syncAccountStatus(stripeAccountId)).ready;
    } catch (error) {
      console.error("Couldn't check the Stripe account", error);
    }
  }

  const settings = settingsRow.data ? bookingSettingsSchema.parse(settingsRow.data) : null;
  const policy = settings ? policyOf(settings.cancellation_policy) : null;

  return (
    <div className="grid max-w-3xl gap-4">
      {!canEdit && (
        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">Your access level lets you see these but not change them.</p>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Stripe</CardTitle>
          <CardDescription>Customers pay deposits straight into your own Stripe account, and Stripe pays you out.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <p>
            {stripeReady
              ? "Stripe is connected. Customers pay by card when they book."
              : stripeAccountId
                ? "Your Stripe setup isn't finished yet, so customers can't pay online. Bookings are taken without a payment step until it is."
                : "Stripe isn't connected. Bookings are taken without a payment step, and you collect any deposit yourself."}
          </p>
          {can("stripe.connect") && !stripeReady && (
            <form action={connectStripeAction.bind(null, slug)}>
              <Button type="submit">{stripeAccountId ? "Continue Stripe setup" : "Connect Stripe"}</Button>
            </form>
          )}
          {stripeReady && (
            <p className="text-muted-foreground">
              Payouts, bank details and fees are managed in{" "}
              <a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer" className="underline underline-offset-4">
                your Stripe Dashboard
              </a>
              . See every payment under{" "}
              <Link href={appUrl(`/${slug}/payments`)} className="underline underline-offset-4">
                Payments
              </Link>
              .
            </p>
          )}
        </CardContent>
      </Card>

      {settings && (
        <Card>
          <CardHeader>
            <CardTitle>Deposit</CardTitle>
            <CardDescription>What customers pay to secure a booking.</CardDescription>
          </CardHeader>
          <CardContent>
            <DepositForm deposit={settings.deposit} action={saveDepositAction.bind(null, slug)} readOnly={!canEdit} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Refunds when customers cancel</CardTitle>
          <CardDescription>Follows your cancellation policy&apos;s cut-off.</CardDescription>
        </CardHeader>
        <CardContent>
          {policy ? (
            <RefundForm policy={policy} action={saveRefundRulesAction.bind(null, slug)} readOnly={!canEdit} />
          ) : (
            <p className="text-sm text-muted-foreground">
              You haven&apos;t set a cancellation policy, so refunds are up to you case by case.{" "}
              <Link href={appUrl(`/${slug}/settings/booking#policy-heading`)} className="underline underline-offset-4">
                Set one under Booking
              </Link>
              .
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
