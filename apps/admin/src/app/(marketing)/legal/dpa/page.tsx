import type { Metadata } from "next";
import { PLATFORM, SUBPROCESSORS } from "@leadgen/core/privacy/platform";

export const metadata: Metadata = { title: "Data Processing Terms" };

// The UK GDPR Article 28 contract between each business (controller) and the
// platform (processor). Accepted at signup and stored on the tenant (terms_
// accepted_at, terms_version). Template wording: have a solicitor review it
// before launch (see info/gdpr.md).
export default function DpaPage() {
  return (
    <>
      <h1>Data Processing Terms</h1>
      <p>
        These terms apply between the business using the platform (the &ldquo;Controller&rdquo;) and{" "}
        {PLATFORM.name} (the &ldquo;Processor&rdquo;) whenever the Processor handles personal data of the
        Controller&apos;s customers. They form part of the Terms of Service and meet Article 28 of the UK
        GDPR.
      </p>

      <h2>1. What is processed</h2>
      <ul>
        <li><strong>Subject matter and purpose:</strong> providing the booking platform: quotes, bookings, payments, reminders and follow-ups.</li>
        <li><strong>Duration:</strong> while the Controller has an account, plus the deletion period in section 9.</li>
        <li><strong>People:</strong> the Controller&apos;s customers and enquirers, and the Controller&apos;s staff listed in the dashboard.</li>
        <li><strong>Data:</strong> names, email addresses, phone numbers, addresses and postcodes, vehicle details, photos, booking and payment details, notes, and marketing consent records.</li>
      </ul>

      <h2>2. Instructions</h2>
      <p>
        The Processor will process the data only on the Controller&apos;s documented instructions, which
        are these terms and the Controller&apos;s use of the platform, unless the law requires otherwise
        (in which case it will say so first, if allowed). It will tell the Controller if it thinks an
        instruction breaks data protection law.
      </p>

      <h2>3. Confidentiality</h2>
      <p>Everyone at the Processor with access to the data is bound by confidentiality.</p>

      <h2>4. Security</h2>
      <p>
        The Processor will keep appropriate technical and organisational measures in place, including:
        separation of each business&apos;s data with database row-level security; private file storage with
        short-lived links; encryption in transit; hashed passwords; access limited to those who need it;
        and regular backups.
      </p>

      <h2>5. Sub-processors</h2>
      <p>
        The Controller gives general authorisation to the sub-processors below. The Processor will tell the
        Controller before adding or replacing one, giving at least 14 days to object. It will bind each to
        terms no less protective than these and stays responsible for them.
      </p>
      <ul>
        {SUBPROCESSORS.map((s) => (
          <li key={s.name}>
            <strong>{s.name}</strong>: {s.does}. Data: {s.data}.
          </li>
        ))}
      </ul>

      <h2>6. International transfers</h2>
      <p>
        Data is transferred outside the UK only with an approved safeguard, such as the UK&apos;s adequacy
        regulations, the International Data Transfer Agreement or the UK Addendum to the EU standard
        contractual clauses.
      </p>

      <h2>7. Helping the Controller</h2>
      <ul>
        <li>
          <strong>Requests from individuals:</strong> the dashboard lets the Controller log requests, export
          a customer&apos;s data and erase it. If the Processor receives a request directly it will pass it on
          without answering it.
        </li>
        <li>
          <strong>Breaches:</strong> the Processor will tell the Controller without undue delay, and aim to
          do so within 48 hours of becoming aware of a breach affecting its data, with what it knows to help the
          Controller decide whether to report it to the ICO (within 72 hours).
        </li>
        <li>
          <strong>Assessments and consultations:</strong> reasonable help with data protection impact
          assessments and prior consultation, taking account of the information it has.
        </li>
      </ul>

      <h2>8. The Controller&apos;s responsibilities</h2>
      <p>
        The Controller is responsible for having a lawful basis for the data it collects, for the privacy
        notice shown on its booking page (the platform provides one using the Controller&apos;s details), for
        registering with the ICO if required, and for consent for marketing under PECR.
      </p>

      <h2>9. Ending the service</h2>
      <p>
        When the account closes the Processor will, at the Controller&apos;s choice, return a copy of the
        data and then delete it within 90 days, unless the law requires it to keep some (such as billing
        records). Backups are deleted on their normal cycle.
      </p>

      <h2>10. Audits</h2>
      <p>
        The Processor will give the Controller the information needed to show compliance with this article
        and allow for reasonable audits, with notice, no more than once a year unless there has been a breach.
      </p>
    </>
  );
}
