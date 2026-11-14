import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { bookingSettingsSchema } from "@leadgen/core/booking/config";
import { policyOf } from "@leadgen/core/settings/policy";
import { syncAccountStatus } from "@leadgen/core/stripe/accounts";
import { DepositForm, RefundForm } from "@/components/dashboard/settings/payment-forms";
import { ReadOnlyNotice, SettingsSection, SettingsStack } from "@/components/dashboard/settings/section";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/urls";
import { connectStripeAction } from "../actions";
import { saveDepositAction, saveRefundRulesAction } from "./actions";

export const metadata: Metadata = { title: "Payments" };

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
  const link = "underline underline-offset-4 hover:text-foreground";

  return (
    <SettingsStack>
      {!canEdit && <ReadOnlyNotice />}
      <SettingsSection
        id="stripe"
        title="Stripe"
        badge={
          <Badge tone={stripeReady ? "success" : stripeAccountId ? "warning" : "neutral"}>
            {stripeReady ? "Connected" : stripeAccountId ? "Setup not finished" : "Not connected"}
          </Badge>
        }
        description="Customers pay deposits straight into your own Stripe account, and Stripe pays you out."
      >
        <div className="grid gap-4">
          <p>
            {stripeReady
              ? "Customers pay by card when they book."
              : stripeAccountId
                ? "Your Stripe setup isn't finished yet, so customers can't pay online. Bookings are taken without a payment step until it is."
                : "Bookings are taken without a payment step, and you collect any deposit yourself."}
          </p>
          {!stripeReady &&
            (can("stripe.connect") ? (
              <form action={connectStripeAction.bind(null, slug)}>
                <Button type="submit" size="lg">
                  {stripeAccountId ? "Continue Stripe setup" : "Connect Stripe"}
                </Button>
              </form>
            ) : (
              <p className="text-muted-foreground">Only the business owner can connect Stripe.</p>
            ))}
          {stripeReady && (
            <div className="flex flex-wrap gap-2">
              <a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" })}>
                Stripe Dashboard <ExternalLink />
              </a>
              {can("money") && (
                <Link href={appUrl(`/${slug}/payments`)} className={buttonVariants({ variant: "outline" })}>
                  See every payment
                </Link>
              )}
            </div>
          )}
          {stripeReady && (
            <p className="text-muted-foreground">Payouts, bank details and Stripe&apos;s fees are managed in your Stripe Dashboard.</p>
          )}
        </div>
      </SettingsSection>

      {settings && (
        <SettingsSection id="deposit" title="Deposit" description="What customers pay to secure a booking.">
          <DepositForm deposit={settings.deposit} stripeReady={stripeReady} action={saveDepositAction.bind(null, slug)} readOnly={!canEdit} />
        </SettingsSection>
      )}

      <SettingsSection
        id="refunds"
        title="Refunds when customers cancel"
        description="Follows the cut-off in your cancellation policy. Refunds are never sent automatically: you send each one with a click."
      >
        {policy ? (
          <RefundForm policy={policy} action={saveRefundRulesAction.bind(null, slug)} readOnly={!canEdit} />
        ) : (
          <p className="text-muted-foreground">
            You haven&apos;t switched on a cancellation policy, so refunds are up to you case by case.{" "}
            <Link href={appUrl(`/${slug}/settings/booking#policy`)} className={link}>
              Set one under Hours &amp; rules
            </Link>
            .
          </p>
        )}
      </SettingsSection>
    </SettingsStack>
  );
}
