import type { Metadata } from "next";
import Link from "next/link";
import { MIN_ONLINE_HOLD_MINUTES } from "@leadgen/core/stripe/rules";
import { Callout, DocTitle, Place, SimpleTable } from "@/components/docs/docs-kit";
import { docsUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "How customers book" };

export default function BookingFlow() {
  return (
    <>
      <DocTitle eyebrow="How it works" title="How customers book">
        <p>
          What your customers see on your booking page, and what happens behind the scenes at each step.
        </p>
      </DocTitle>

      <h2>Your booking page</h2>
      <p>Every business gets its own booking site, in its own colours. It has:</p>
      <ul>
        <li>
          <strong>a home page</strong> listing your services with prices &quot;from&quot;
        </li>
        <li>
          <strong>a page for each service</strong>, with photos, what&apos;s included, the steps you follow and FAQs
        </li>
        <li>
          <strong>the quote and booking form</strong>, which works out the price as the customer answers
        </li>
        <li>
          <strong>a privacy notice</strong> and a form for data requests (see{" "}
          <Link href={docsUrl("/privacy")}>Customer data and privacy</Link>)
        </li>
      </ul>
      <p>
        The same booking form can open in a panel on your own website. See{" "}
        <Link href={docsUrl("/website")}>Your website and booking link</Link>.
      </p>

      <h2>The booking form, step by step</h2>
      <p>
        It&apos;s one page. Each step folds down to a one-line summary once it&apos;s answered, and the running price
        stays on screen the whole time. On a phone it&apos;s a single column.
      </p>
      <SimpleTable
        head={["Step", "What the customer does"]}
        rows={[
          ["Service", "Picks a package. Skipped if they came from a service's own page."],
          [
            "Your car",
            "Picks the make and model, and the size is suggested from it (they can change it). Adds photos if they like. If you price by condition, the photos are checked when they continue, and the price includes the car's condition.",
          ],
          [
            "Extras and options",
            "Adds any extras, and ticks anything you should know about, such as pet hair, stains or child seats, so you bring the right kit.",
          ],
          [
            "Where",
            "Chooses their address or dropping the car at your unit, if you offer both. For mobile jobs: the address (checked against your coverage area), whether there's a tap and a socket, where the car will be parked, and how you'll get the keys.",
          ],
          [
            "Your details",
            "Name, email and mobile number. Optionally, how they'd like you to contact them and how they heard about you.",
          ],
          [
            "Date and time",
            "Picks a day, then a start time. Days that are closed or fully booked are greyed out.",
          ],
          ["Review and book", "Checks the summary, ticks to agree, and books."],
        ]}
      />

      <h3>Prices are worked out for them, not by them</h3>
      <p>
        Every price comes from your own rules: base price, vehicle size, condition, extras, call-out fee and minimum
        charge. The form only shows the result, and the same sum runs again on the server when they book, so the price
        can&apos;t be changed in the browser. See <Link href={docsUrl("/pricing")}>Packages and pricing</Link>.
      </p>

      <h3>Only real times are offered</h3>
      <p>
        Times come from your working hours, the jobs already booked, any time you&apos;ve blocked out, and the drive
        between jobs. A time is only shown if one of your vans or bays can actually do the job then. See{" "}
        <Link href={docsUrl("/availability")}>Hours, vans and travel</Link>.
      </p>

      <h2 id="leads">Leads: people who didn&apos;t finish</h2>
      <p>
        As soon as a customer has given their contact details, they&apos;re saved as a <strong>lead</strong> with the
        quote they were looking at. If they leave before booking, you can still follow them up. They&apos;re in{" "}
        <Place>Leads</Place>, with everything they filled in.
      </p>
      <p>
        If the same person comes back and enquires again, their existing lead is updated rather than a second one being
        made.
      </p>

      <h2 id="holds">Holding the time while they pay</h2>
      <p>
        When the customer presses book, the price and the time are checked again on the server, then the time is{" "}
        <strong>held</strong> for them. Nobody else can book it while it&apos;s held.
      </p>
      <ul>
        <li>
          <strong>With an online deposit</strong>, they go to Stripe&apos;s secure checkout to pay. The hold lasts for
          your <Place>Hold a slot while paying</Place> setting, and never less than {MIN_ONLINE_HOLD_MINUTES} minutes,
          so it can&apos;t run out while Stripe&apos;s checkout is still open. Once the payment goes through, the
          booking is confirmed.
        </li>
        <li>
          <strong>With no online deposit</strong>, the booking is confirmed straight away. That&apos;s when your deposit
          is set to none, or Stripe isn&apos;t connected yet. You collect any deposit yourself.
        </li>
      </ul>
      <p>
        If they give up on the payment, or it fails, the hold ends and the time goes back on sale. If a payment arrives
        after the hold ran out and someone else has taken the time since, the deposit is refunded in full
        automatically, so nobody pays for a time they didn&apos;t get.
      </p>

      <h2>After booking</h2>
      <p>
        The customer sees a confirmation page with the service, the time and what they&apos;ve paid. On your side the
        booking appears in your <Place>Calendar</Place> and <Place>Bookings</Place>, with every answer they gave and any
        photos they added.
      </p>
      <h2 id="photos">How photos set the condition</h2>
      <p>
        If you price by condition, customers aren&apos;t asked what state their car is in. When they continue past{" "}
        <strong>Your car</strong>, AI looks at their photos and picks the matching level from your{" "}
        <Link href={docsUrl("/pricing")}>condition levels</Link>. It takes a few seconds, and the price updates before they pay.
      </p>
      <ul>
        <li>
          <strong>Confident:</strong> they see &quot;From your photos: Heavy&quot; and the condition line is in their
          price.
        </li>
        <li>
          <strong>Not sure</strong> (dark, blurry, or not enough of the car): they&apos;re told, and can add clearer
          photos or carry on.
        </li>
        <li>
          <strong>No photos, or still not sure:</strong> they book with no condition uplift, and are told you&apos;ll
          confirm the price when you see the car.
        </li>
      </ul>
      <p>
        Bookings and leads show the level the photos gave, how sure the check was and a note on what it saw, or why the
        price still needs confirming.
      </p>
      <Callout>
        <p>
          Photos are only used to work out the condition. They&apos;re sent to Anthropic, the company behind the AI, for
          the check, with no name or contact details, and Anthropic is listed on your privacy notice.
        </p>
      </Callout>
    </>
  );
}
