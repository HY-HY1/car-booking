import type { Metadata } from "next";
import Link from "next/link";
import { TRIAL_DAYS } from "@leadgen/core/billing/rules";
import { Callout, DocTitle, Place, SimpleTable } from "@/components/docs/docs-kit";
import { appUrl, docsUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Getting started" };

export default function GettingStarted() {

  return (
    <>
      <DocTitle eyebrow="Start here" title="Getting started">
        <p>From signing up to taking your first booking, usually in under an hour.</p>
      </DocTitle>

      <h2>1. Create your account</h2>
      <p>
        Go to <a href={appUrl("/signup")}>the sign-up page</a> and tell us:
      </p>
      <ul>
        <li>your name, email and a password</li>
        <li>your business name, and whether you do detailing, valeting or both</li>
        <li>
          where you work: at customers&apos; addresses (mobile), at your own unit (customers drop the car off), or both
        </li>
        <li>your postcode: where your van starts from, or where your unit is</li>
      </ul>
      <p>
        The last step takes a card for your subscription. You get a {TRIAL_DAYS}-day free trial and nothing is charged
        until it ends. Once that&apos;s done you land on your <strong>Setup</strong> page.
      </p>
      <Callout>
        <p>
          Your business is created with a few starter services, a van or bay, and sensible booking rules, so the booking
          page works straight away. The setup steps below replace the placeholders with your own details.
        </p>
      </Callout>

      <h2>2. Work through the setup checklist</h2>
      <p>
        <Place>Setup</Place> in the dashboard shows what&apos;s left. It ticks steps off by itself as you go. Until the
        required ones are done, a &quot;Finish setting up&quot; banner stays on your dashboard.
      </p>
      <SimpleTable
        head={["Step", "Needed?", "Where"]}
        rows={[
          [
            "Set your services and prices",
            "Yes",
            <>
              <Place>Packages</Place>. Change or replace the starter services. See{" "}
              <Link href={docsUrl("/pricing")}>Packages and pricing</Link>.
            </>,
          ],
          [
            "Set your working hours",
            "Yes",
            <>
              <Place>Settings → Booking</Place>. Mobile hours, and shop hours if you have a unit.
            </>,
          ],
          [
            "Say where your van starts",
            "If you do mobile jobs",
            <>
              <Place>Settings → Booking</Place>. Used to work out travel time and your coverage area.
            </>,
          ],
          [
            "Connect Stripe",
            "If you take a deposit",
            <>
              <Place>Settings → Payments</Place>. See <Link href={docsUrl("/payments")}>Deposits and payments</Link>.
            </>,
          ],
          [
            "Booking address live",
            "Yes",
            "Done for you when you sign up. If it says it's waiting on us, we're still checking it.",
          ],
          ["Your first enquiry", "No", "Ticks itself off when the first customer gets a quote or books."],
        ]}
      />

      <h2>3. Share your booking page</h2>
      <p>
        Your booking address is shown on the <Place>Setup</Place> page with a copy button. Put it wherever customers find
        you:
      </p>
      <ul>
        <li>your Instagram and Facebook bio</li>
        <li>your Google Business Profile, as the booking link</li>
        <li>saved replies in WhatsApp</li>
      </ul>
      <p>
        If you have a website, add the <strong>Instant quote</strong> button to it with one line of code. See{" "}
        <Link href={docsUrl("/website")}>Your website and booking link</Link>.
      </p>

      <h2>4. Take a test booking</h2>
      <p>
        Open your booking page and book something yourself. You&apos;ll see the price build up as you choose, the times
        offered around your hours, and the booking land in your <Place>Calendar</Place> and <Place>Bookings</Place>.
        Cancel it afterwards from either.
      </p>
      <Callout tone="warning">
        <p>
          If Stripe is connected and you take a deposit, a test booking takes a real payment. Refund it from the
          booking&apos;s page in the dashboard.
        </p>
      </Callout>

      <h2>Adding your team</h2>
      <p>
        Your account is the business <strong>owner</strong>. Ask us to add a <strong>staff</strong> login for anyone
        who helps run the day-to-day: they can use the diary and bookings without seeing your income or changing
        prices. See{" "}
        <Link href={docsUrl("/dashboard#roles")}>Your dashboard</Link> for what each role can do.
      </p>
    </>
  );
}
