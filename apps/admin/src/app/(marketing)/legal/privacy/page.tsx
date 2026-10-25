import type { Metadata } from "next";
import { PLATFORM, SUBPROCESSORS } from "@leadgen/core/privacy/platform";

export const metadata: Metadata = { title: "Privacy Policy" };

// ASCND as controller: this covers the business owners and staff who use the
// dashboard. Their customers' data is covered by the Data Processing Terms
// and each business's own privacy notice. Template wording: have a solicitor
// review it before launch (see info/gdpr.md).
export default function PrivacyPolicyPage() {
  const contact = PLATFORM.privacyEmail ?? "the contact details in your welcome email";
  return (
    <>
      <h1>Privacy Policy</h1>
      <p>
        This policy is about the personal data {PLATFORM.name} (&ldquo;we&rdquo;) holds about the people who
        sign up for and use our booking platform: business owners and their staff. We are the
        controller of that data.
      </p>
      <p>
        If you are a customer of one of our businesses, they are the controller of your data and we only
        process it for them. Read their privacy notice, linked at the bottom of their booking page.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>Your name, email address and password (stored only as a one-way hash).</li>
        <li>Your business name, trade, locations, postcode and the settings you choose.</li>
        <li>Subscription and billing details. Card numbers are handled by Stripe and never reach us.</li>
        <li>Records of what you do in the dashboard and technical logs (IP address, browser), for security and support.</li>
      </ul>

      <h2>Why, and our legal basis</h2>
      <ul>
        <li>To create your account and provide the service you signed up for (contract).</li>
        <li>To take payment and keep financial records (contract and legal obligation).</li>
        <li>To keep the service secure and fix problems (legitimate interests).</li>
        <li>To tell you about changes to the service or these terms (contract and legitimate interests).</li>
      </ul>

      <h2>Who we share it with</h2>
      <p>We don&apos;t sell personal data. We use these providers to run the platform:</p>
      <ul>
        {SUBPROCESSORS.map((s) => (
          <li key={s.name}>
            <strong>{s.name}</strong>: {s.does.toLowerCase()}.
          </li>
        ))}
      </ul>
      <p>
        Some of them may process data outside the UK, under the UK&apos;s approved safeguards (the
        International Data Transfer Agreement or the UK Addendum).
      </p>

      <h2>How long we keep it</h2>
      <p>
        Account data is kept while you have an account. When you close it we delete or anonymise it within
        90 days, except billing records, which we keep for six years for tax and accounting.
      </p>

      <h2>Cookies</h2>
      <p>
        The dashboard uses only the cookies needed to keep you signed in. We don&apos;t use advertising or
        analytics cookies.
      </p>

      <h2>Your rights</h2>
      <p>
        You can ask us for a copy of your data, to correct or delete it, to restrict or object to how we
        use it, or to receive it in a portable format. Contact {contact}. We&apos;ll reply within one month.
        You can also complain to the Information Commissioner&apos;s Office at{" "}
        <a href="https://ico.org.uk/make-a-complaint/" className="underline">ico.org.uk</a>.
      </p>
    </>
  );
}
