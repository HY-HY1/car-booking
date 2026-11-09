import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { formatPence } from "@leadgen/core/booking/config";
import { getBookingConfig } from "@leadgen/core/booking/engine";
import { policyLines, policyOf } from "@leadgen/core/settings/policy";
import { ContactLinks } from "@/components/contact-links";
import { LegalPage } from "@/components/legal-page";
import { getRequestTenant } from "@/lib/tenant";

export const metadata: Metadata = { title: "Booking terms" };

// The terms a booking is made on, built from what the business has set up,
// for those without their own (Settings → Booking page). A template, to be
// checked by a solicitor before launch, like the privacy notice.
export default async function TermsPage() {
  const tenant = await getRequestTenant();
  if (!tenant) notFound();
  if (tenant.branding.terms_url) redirect(tenant.branding.terms_url);

  const config = await getBookingConfig(tenant.id);
  const who = tenant.privacy.legalName || tenant.name;
  const deposit = config?.settings.deposit;
  const policy = policyOf(config?.settings.cancellation_policy);
  const lines = policy ? policyLines(policy, deposit?.type !== "none") : null;

  return (
    <LegalPage title="Booking terms">
      <p>These terms apply when you book a job with {who} on this site.</p>

      <h2>Your booking</h2>
      <ul>
        <li>The price you&apos;re shown when you book is the price of the job as you described it.</li>
        <li>
          If the car&apos;s size or condition doesn&apos;t match what was booked, {tenant.name} may change the price
          when they see it.
        </li>
        <li>Please make sure the car can be reached at the time you booked.</li>
      </ul>

      {deposit && deposit.type !== "none" && (
        <>
          <h2>Paying</h2>
          <p>
            {deposit.type === "full"
              ? "The full price is paid when you book."
              : deposit.type === "fixed"
                ? `A deposit of ${formatPence(deposit.value_pence)} secures your booking.`
                : `A deposit of ${deposit.value}% of the price secures your booking.`}
            {deposit.type !== "full" && " The balance is paid to the business, and the deposit counts towards it."}
          </p>
        </>
      )}

      <h2>Cancelling or changing</h2>
      {lines ? (
        <ul>
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : (
        <p>If you need to cancel or change your booking, get in touch with {tenant.name} as soon as you can.</p>
      )}

      <h2>Contact</h2>
      <div className="mt-3">
        <ContactLinks phone={tenant.contact.phone} email={tenant.contact.email} />
      </div>
    </LegalPage>
  );
}
