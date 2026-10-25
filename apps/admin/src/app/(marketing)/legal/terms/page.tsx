import type { Metadata } from "next";
import { PLATFORM } from "@leadgen/core/privacy/platform";
import { marketingUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Terms of Service" };

// Short-form service terms for the self-serve signup. Template wording: have
// a solicitor review it before launch (see info/gdpr.md). Prices and the trial
// length are shown at signup and on the Stripe checkout, so they aren't
// repeated here.
export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p>
        These terms are between {PLATFORM.name} (&ldquo;we&rdquo;) and the business that signs up
        (&ldquo;you&rdquo;). By creating an account you agree to them.
      </p>

      <h2>The service</h2>
      <p>
        We provide an online booking platform: a booking page for your customers, a dashboard to manage
        bookings, customers and payments, and related tools. We may improve or change features over time.
      </p>

      <h2>Your account</h2>
      <ol>
        <li>You must be authorised to act for the business and keep your sign-in details secret.</li>
        <li>You are responsible for what happens under your account and for the accuracy of the prices, hours and areas you set.</li>
        <li>You are the one who contracts with your customers. We aren&apos;t a party to those bookings.</li>
      </ol>

      <h2>Trial, price and cancelling</h2>
      <p>
        New accounts start with a free trial. A card is taken up front and the subscription starts
        automatically when the trial ends, at the price shown when you sign up. You can cancel at any time;
        access continues to the end of the period you&apos;ve paid for. Unless the law says otherwise,
        payments already made aren&apos;t refunded.
      </p>

      <h2>Payments from your customers</h2>
      <p>
        Deposits and payments from your customers are processed by Stripe and paid to your own Stripe
        account, under Stripe&apos;s terms. We don&apos;t hold your customers&apos; money.
      </p>

      <h2>Your customers&apos; data</h2>
      <p>
        You are the controller of your customers&apos; personal data and we are your processor. The{" "}
        <a href={marketingUrl("/legal/dpa")} className="underline">Data Processing Terms</a> apply and form part of this
        agreement. You must have a lawful basis for the messages you send, and get consent for marketing where
        the law requires it.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Don&apos;t use the platform for anything unlawful, to send spam, to try to break or overload it, or to
        access another business&apos;s data.
      </p>

      <h2>Availability and liability</h2>
      <p>
        We work to keep the service running but can&apos;t promise it will never be interrupted. Nothing
        limits liability that can&apos;t legally be limited. Otherwise, our total liability to you in any 12
        months is limited to the fees you paid us in that period, and we aren&apos;t liable for lost profits or
        indirect losses.
      </p>

      <h2>Ending the agreement</h2>
      <p>
        You can close your account at any time. We may suspend or end it if you seriously breach these terms
        or don&apos;t pay. On closure we handle your data as set out in the Data Processing Terms.
      </p>

      <h2>Changes and law</h2>
      <p>
        We&apos;ll tell you before changing these terms in a way that matters. They are governed by the law of
        England and Wales.
      </p>
    </>
  );
}
