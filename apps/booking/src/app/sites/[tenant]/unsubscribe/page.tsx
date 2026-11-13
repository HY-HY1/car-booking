import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalPage } from "@/components/legal-page";
import { unsubscribeClaim } from "@/lib/unsubscribe";
import { getRequestTenant } from "@/lib/tenant";
import { UnsubscribeForm } from "./unsubscribe-form";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };

// /unsubscribe?t=<signed token>, linked from every marketing message. Opening
// the link only asks: mail scanners and link previews open links without
// anyone clicking, so the opt-out waits for the button. Mail apps' own
// unsubscribe button posts to /unsubscribe/one-click instead (RFC 8058).
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const tenant = await getRequestTenant();
  if (!tenant || !process.env.PRIVACY_TOKEN_SECRET) notFound();

  const token = (await searchParams).t ?? "";
  const claim = await unsubscribeClaim(tenant.id, token);

  if (!claim) {
    return (
      <LegalPage tenant={tenant} title="That link isn't valid">
        <p>It may be incomplete or out of date. You can also make a request on the privacy page.</p>
      </LegalPage>
    );
  }
  return (
    <LegalPage tenant={tenant} title={`Unsubscribe from ${tenant.name}`}>
      <p>
        Stop marketing emails from {tenant.name}, such as offers, aftercare tips and reminders to book again. You&apos;ll still
        get messages about bookings you make.
      </p>
      <UnsubscribeForm token={token} businessName={tenant.name} />
    </LegalPage>
  );
}
