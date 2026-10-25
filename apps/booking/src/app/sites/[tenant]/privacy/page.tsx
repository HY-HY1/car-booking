import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PLATFORM, SUBPROCESSORS, TERMS_VERSION } from "@leadgen/core/privacy/platform";
import { LegalPage } from "@/components/legal-page";
import { getRequestTenant } from "@/lib/tenant";
import { pageUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Privacy notice" };

// The business's privacy notice, shown on its own booking address. The
// business is the controller; ASCND is its processor. Wording is a template
// to be checked by a solicitor before launch (see info/gdpr.md).
export default async function PrivacyPage() {
  const tenant = await getRequestTenant();
  if (!tenant) notFound();
  const { privacy } = tenant;
  const who = privacy.legalName || tenant.name;
  const months = privacy.retentionMonths;

  return (
    <LegalPage title="Privacy notice" updated={TERMS_VERSION}>
      <p>
        This explains how {who} (&ldquo;we&rdquo;) uses your personal data when you ask for a quote or
        book a detail with us. We are the controller of that data.
        {privacy.icoRegistration && <> We are registered with the ICO under {privacy.icoRegistration}.</>}
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>Your name, email address and mobile number.</li>
        <li>Your address or postcode, and notes about where the car will be (water, power, parking).</li>
        <li>Your vehicle&apos;s make, model, size and registration, and any photos you upload of it.</li>
        <li>Your quote, booking and deposit details. Card numbers go straight to Stripe; we never see them.</li>
        <li>Your marketing choices, and when you made them.</li>
      </ul>

      <h2>Why we use it, and our legal basis</h2>
      <ul>
        <li>
          <strong>To quote, book and carry out your job</strong>, including taking a deposit and
          sending confirmations and reminders about it. Basis: it&apos;s needed for the contract, or to
          take steps you asked for before one.
        </li>
        <li>
          <strong>To follow up an enquiry you didn&apos;t finish</strong>, for example to ask if you
          still want to book. Basis: our legitimate interest in winning the work, balanced against
          your right not to be pestered. You can ask us to stop at any time.
        </li>
        <li>
          <strong>To keep business and tax records.</strong> Basis: legal obligation.
        </li>
        <li>
          <strong>Marketing emails</strong>, such as reminders that your car is due another clean and
          offers, only if you tick the box when you book. Basis: your consent. You can withdraw it at
          any time using the link in any message, or by contacting us.
        </li>
      </ul>

      <h2>Who we share it with</h2>
      <p>
        We don&apos;t sell your data. We use these companies to run the booking service. They process
        it only on our instructions:
      </p>
      <ul>
        <li>{PLATFORM.name}, who provides the booking system and is our processor.</li>
        {SUBPROCESSORS.map((s) => (
          <li key={s.name}>
            {s.name}: {s.does.toLowerCase()}.
          </li>
        ))}
      </ul>
      <p>
        Some of these companies may handle data outside the UK. Where they do, it is protected by the
        UK&apos;s approved safeguards, such as the International Data Transfer Agreement or the UK
        Addendum.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep your personal details for {months} months after your last enquiry or booking, then
        erase them. Unconfirmed photo uploads are deleted after a day. Records of completed jobs and
        payments are kept for as long as the law requires for accounts (normally six years), but with
        your name, contact details, address and notes removed once the period above has passed or you
        ask us to erase them.
      </p>

      <h2>Your rights</h2>
      <p>You can ask us to:</p>
      <ul>
        <li>give you a copy of the data we hold about you;</li>
        <li>correct anything that is wrong;</li>
        <li>erase your data;</li>
        <li>stop using it for marketing or for following up enquiries;</li>
        <li>give you your data in a portable format, where the law applies.</li>
      </ul>
      <p>
        <Link href={pageUrl(tenant, "/privacy/request")} className="underline">Make a request here</Link>
        {privacy.contactEmail && <> or email {privacy.contactEmail}</>}. We&apos;ll reply within one
        month. We may ask you to confirm who you are first, so we don&apos;t give your data to someone
        else.
      </p>
      <p>
        If you&apos;re unhappy with how we&apos;ve handled your data you can complain to the
        Information Commissioner&apos;s Office at{" "}
        <a href="https://ico.org.uk/make-a-complaint/" className="underline">ico.org.uk</a> or on 0303 123 1113.
        We&apos;d like the chance to put it right first.
      </p>

      <h2>Cookies</h2>
      <p>
        This booking page uses no advertising or analytics cookies. Anything it stores in your browser
        is only there to make the booking form work.
      </p>
    </LegalPage>
  );
}
