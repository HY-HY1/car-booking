import type { Metadata } from "next";
import Link from "next/link";
import { REQUEST_KINDS } from "@leadgen/core/privacy/rules";
import { Callout, DocTitle, Place } from "@/components/docs/docs-kit";
import { docsUrl, marketingUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Customer data and privacy" };

export default function Privacy() {

  return (
    <>
      <DocTitle eyebrow="How it works" title="Customer data and privacy">
        <p>The tools that help you look after your customers&apos; data under UK GDPR.</p>
      </DocTitle>

      <h2>Who is responsible for what</h2>
      <p>
        Your customers&apos; details belong to your business: you&apos;re the <strong>controller</strong>. We store and
        process them on your behalf as your <strong>processor</strong>, under our{" "}
        <a href={marketingUrl("/legal/dpa")}>data processing terms</a>. For your own account details (your name, email
        and billing), we&apos;re the controller. See our <a href={marketingUrl("/legal/privacy")}>privacy policy</a>.
      </p>
      <Callout>
        <p>
          Most businesses that handle customer details need to register with the ICO and pay its data protection fee.
          Once you have your number, add it under <Place>Settings → Privacy</Place> and it appears on your privacy
          notice.
        </p>
      </Callout>

      <h2>Your privacy notice</h2>
      <p>
        Your booking page has a privacy notice at <code>/privacy</code>, linked from the footer and from the booking
        form. It names your business as the controller, says what&apos;s collected and why, and lists the companies
        involved in running the platform. Fill in your legal or trading name and a privacy contact email under{" "}
        <Place>Settings → Privacy</Place> so it&apos;s about you.
      </p>

      <h2>Data requests</h2>
      <p>
        Customers can ask about their data using the form at <code>/privacy/request</code> on your booking page. They
        can ask to:
      </p>
      <ul>
        {Object.values(REQUEST_KINDS).map((kind) => (
          <li key={kind}>{kind.toLowerCase()}</li>
        ))}
      </ul>
      <p>
        Requests arrive under <Place>Settings → Privacy</Place>, each with a due date one month after it came in, which
        is the legal deadline. If someone asks in person, by phone or by email instead, log it there yourself.
      </p>
      <p>Working a request:</p>
      <ol>
        <li>
          <strong>Check who they are.</strong> Nothing is sent or deleted automatically, because the form can&apos;t
          prove the person is who they say. Tick <Place>I&apos;ve checked who they are</Place> once you have.
        </li>
        <li>
          <strong>Do what they asked</strong>, using the tools below.
        </li>
        <li>
          <strong>Note what you did</strong> and mark it completed (or refused, with the reason). The log is your record
          if anyone asks later.
        </li>
      </ol>

      <h2>Downloading a customer&apos;s data</h2>
      <p>
        On a customer&apos;s page, <Place>Download their data</Place> gives you everything held about them in one file:
        contact details, vehicles, bookings, leads and their answers, a list of their photos, their consent history and
        any past requests. Send it to them, with the photos themselves if they want them, for an access request. Owner
        only.
      </p>

      <h2>Erasing a customer</h2>
      <p>
        On a customer&apos;s page, <Place>Erase customer</Place>. Owner only, and it can&apos;t be undone.
      </p>
      <ul>
        <li>
          <strong>No bookings:</strong> the customer is deleted completely, along with their vehicles, leads and photos.
        </li>
        <li>
          <strong>Has bookings:</strong> the bookings are kept for your accounts, but anonymised. Their name, contact
          details, address, notes, vehicles and photos are removed.
        </li>
      </ul>
      <Callout tone="warning">
        <p>
          Records of card payments are kept by Stripe and aren&apos;t touched by erasing. If needed, deal with those in
          your Stripe Dashboard too.
        </p>
      </Callout>

      <h2>How long data is kept</h2>
      <p>
        Under <Place>Settings → Privacy</Place>, choose how long to keep a customer&apos;s details after they last booked
        or enquired: between 1 and 7 years, 3 by default. Once a week, customers with no activity for that long are
        erased automatically, in the same way as above.
      </p>
      <p>Photos a customer uploads but doesn&apos;t end up booking with are deleted after a day.</p>

      <h2>Marketing consent</h2>
      <p>
        Each customer records whether they&apos;ve agreed to marketing, and every change to that is logged with when it
        happened. Booking confirmations and reminders are part of the service and don&apos;t need consent. Offers and
        &quot;time for another clean&quot; messages count as marketing.
      </p>
      <p>
        More on the rules from the <a href="https://ico.org.uk/for-organisations/">ICO&apos;s guidance for
        organisations</a>. See also <Link href={docsUrl("/dashboard#roles")}>who on your team can do what</Link>.
      </p>
    </>
  );
}
