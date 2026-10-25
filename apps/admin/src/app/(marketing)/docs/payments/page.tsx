import type { Metadata } from "next";
import Link from "next/link";
import { formatPence } from "@leadgen/core/booking/config";
import { MIN_CHARGE_PENCE } from "@leadgen/core/stripe/rules";
import { Callout, DocTitle, Place, SimpleTable } from "@/components/docs/docs-kit";
import { docsUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Deposits and payments" };

export default function Payments() {
  return (
    <>
      <DocTitle eyebrow="How it works" title="Deposits and payments">
        <p>
          Customers pay deposits by card when they book, straight into your own Stripe account. Fewer no-shows, and the
          money never passes through us.
        </p>
      </DocTitle>

      <h2>Connecting Stripe</h2>
      <p>
        Card payments go through <a href="https://stripe.com/gb">Stripe</a>. You get your own Stripe account, linked to
        your dashboard, and payouts go to your bank on Stripe&apos;s normal schedule.
      </p>
      <ol>
        <li>
          Go to <Place>Settings → Payments</Place> and press connect. Only the business owner can do this.
        </li>
        <li>
          Stripe asks for your business details, your identity and your bank account. Have them handy: it takes about
          10 minutes.
        </li>
        <li>
          You come back to your dashboard. Once Stripe has checked your details, the card says{" "}
          <em>Stripe is connected</em> and deposits switch on by themselves.
        </li>
      </ol>
      <p>
        If Stripe needs more from you later, the card in <Place>Settings</Place> says so and takes you back to finish.
      </p>

      <h2>What happens with and without Stripe</h2>
      <SimpleTable
        head={["Your setup", "What customers see"]}
        rows={[
          ["Stripe connected, deposit set", "They pay the deposit by card to finish booking."],
          [
            "Stripe connected, no deposit",
            "They book without paying. Use payment links if you want money up front for a particular job.",
          ],
          [
            "Stripe not connected, or not finished",
            "They book without a deposit step, whatever your deposit setting. You collect any deposit yourself.",
          ],
        ]}
      />
      <p>
        Set the deposit under <Place>Packages</Place>: none, a percentage of the total, or a fixed amount. See{" "}
        <Link href={docsUrl("/pricing")}>Packages and pricing</Link>. Stripe can&apos;t take a payment under{" "}
        {formatPence(MIN_CHARGE_PENCE)}, so a deposit smaller than that isn&apos;t collected online.
      </p>
      <p>
        While the customer pays, their time is held so nobody else can take it. See{" "}
        <Link href={docsUrl("/booking-flow#holds")}>Holding the time while they pay</Link>.
      </p>

      <h2>Seeing your payments</h2>
      <p>
        <Place>Payments</Place> lists every card payment into your Stripe account, newest first, matched to the booking
        it was for. It&apos;s read live from Stripe, so it&apos;s always up to date. Your income also shows on your
        dashboard&apos;s overview.
      </p>
      <p>Only the business owner can see payments and income.</p>

      <h2>Refunding a deposit</h2>
      <p>
        Open the booking from <Place>Bookings</Place> and choose <Place>Refund deposit</Place>. It asks you to confirm
        first. The full deposit goes back to the customer&apos;s card, usually within 5 to 10 working days.
      </p>
      <Callout tone="warning">
        <p>
          Stripe keeps its processing fee when you refund, so a refund costs you slightly more than the deposit. A
          refund can&apos;t be undone.
        </p>
      </Callout>
      <p>
        If a customer disputes a payment with their bank, the booking shows the deposit as disputed. Disputes are
        between you and the customer&apos;s bank: respond to it from your own Stripe Dashboard.
      </p>

      <h2>Payment links</h2>
      <p>
        A payment link is a Stripe checkout page for an amount you choose, to send to a customer by text, WhatsApp or
        email. Use one for the balance after a job, an extra you agreed on the day, or a deposit for a job you booked
        over the phone.
      </p>
      <ol>
        <li>
          Go to <Place>Payments → Payment links</Place>.
        </li>
        <li>
          Optionally pick a booking, and the balance still owed on it is filled in. You can change the amount.
        </li>
        <li>Add a description. The customer sees it on the payment page.</li>
        <li>
          Leave <strong>one-off</strong> ticked and the link stops working after one payment. Untick it for a link you
          can reuse, such as a standard top-up.
        </li>
      </ol>
      <p>
        You can switch a link off at any time. Payments made through a link appear in <Place>Payments</Place> like any
        other.
      </p>

      <h2>Your subscription</h2>
      <p>
        What you pay us is separate from your customers&apos; payments. It&apos;s billed to the card you gave when you
        signed up, and you can see your plan under <Place>Settings → Subscription</Place>.
      </p>
    </>
  );
}
