import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalPage } from "@/components/legal-page";
import { getRequestTenant } from "@/lib/tenant";
import { optInClaim } from "@/lib/unsubscribe";
import { SubscribeForm } from "./subscribe-form";

export const metadata: Metadata = { title: "Confirm your subscription", robots: { index: false } };

// /subscribe?t=<signed token>, from the email sent when a customer ticks
// "send me offers" on the booking page (double opt-in). Like /unsubscribe,
// opening the link only asks: mail scanners open links without anyone
// clicking, so consent waits for the button.
export default async function SubscribePage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const tenant = await getRequestTenant();
  if (!tenant || !process.env.PRIVACY_TOKEN_SECRET) notFound();

  const token = (await searchParams).t ?? "";
  const claim = await optInClaim(tenant.id, token);

  if (!claim) {
    return (
      <LegalPage tenant={tenant} title="That link isn't valid">
        <p>It may be incomplete or out of date.</p>
      </LegalPage>
    );
  }
  return (
    <LegalPage tenant={tenant} title={`Offers from ${tenant.name}`}>
      <p>
        Get offers, aftercare tips and reminders to book again from {tenant.name} by email. Every email has a link to stop
        them.
      </p>
      <SubscribeForm token={token} businessName={tenant.name} />
    </LegalPage>
  );
}
