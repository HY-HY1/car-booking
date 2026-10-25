import type { Metadata } from "next";
import Link from "next/link";
import { DocTitle, Place, SimpleTable } from "@/components/docs/docs-kit";
import { docsUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Your dashboard" };

export default function Dashboard() {
  return (
    <>
      <DocTitle eyebrow="How it works" title="Your dashboard">
        <p>A tour of the dashboard, where you and your team run bookings day to day.</p>
      </DocTitle>

      <p>
        The menu is grouped the same way as this page. The search box at the top finds customers, bookings and leads by
        name, email, phone or postcode, and jumps to any dashboard page by name.
      </p>

      <h2>Overview</h2>
      <h3>Dashboard</h3>
      <p>
        How the business is doing. Switch between day, week, month and year, and step back through earlier periods.
        You&apos;ll see jobs and income against the period before, charts of both, what&apos;s coming up next and your
        most-booked services. Income is shown to the owner only.
      </p>

      <h3>Calendar</h3>
      <p>Your diary, by day or by week.</p>
      <ul>
        <li>The day view has a column for each van or bay. The week view can be filtered to one.</li>
        <li>Jobs are coloured by status, and blocked-out time is shaded.</li>
        <li>The estimated drive between one mobile job and the next is shown in the gap.</li>
        <li>
          Click a job to see its details and mark it <strong>completed</strong>, a <strong>no-show</strong> or{" "}
          <strong>cancelled</strong>. Put it back if you change your mind.
        </li>
        <li>
          <Place>Block out time</Place> stops customers booking a stretch of time, for the whole business or one van.
        </li>
      </ul>

      <h3>Bookings</h3>
      <p>
        Every booking, with its status and deposit. Open one to see everything the customer told you, their photos, the
        price breakdown and the payment, and to refund the deposit. A booking is one of:
      </p>
      <SimpleTable
        head={["Status", "Meaning"]}
        rows={[
          ["Held", "The customer is paying the deposit right now. The time is reserved for a short while."],
          ["Confirmed", "Booked. It's in your calendar."],
          ["Completed", "You've done the job."],
          ["No-show", "The customer wasn't there or didn't bring the car."],
          ["Cancelled", "Called off, by you or the customer."],
        ]}
      />

      <h3>Leads</h3>
      <p>
        Everyone who gave their contact details on your booking page, including the ones who didn&apos;t book. Each
        lead keeps the quote they saw and their answers, so you can call them back knowing what they wanted. See{" "}
        <Link href={docsUrl("/booking-flow#leads")}>Leads</Link>.
      </p>

      <h2>Services</h2>
      <h3>Packages</h3>
      <p>
        Your services, extras, condition levels, deposit, minimum charge and call-out fee, plus each service&apos;s page
        content and photos. See <Link href={docsUrl("/pricing")}>Packages and pricing</Link>.
      </p>
      <h3>Coverage Area</h3>
      <p>
        A map of where you&apos;ll travel, with circles you can drag and resize. See{" "}
        <Link href={docsUrl("/availability#coverage")}>Coverage area</Link>.
      </p>
      <h3>Staff / Techs</h3>
      <p>
        A list of the people who do the work: name, job title, contact details, notes, and the van and territory
        they&apos;re usually on. This is a record for you, not a login. Logins are covered under{" "}
        <a href="#roles">Team roles</a>.
      </p>

      <h2>Marketing</h2>
      <h3>Customers</h3>
      <p>
        Everyone who has booked or enquired, plus anyone you add yourself with <Place>Add customer</Place>. A
        customer&apos;s page shows their contact details, vehicles, photos, past and upcoming jobs, and whether
        they&apos;ve agreed to marketing. The owner can also download or erase a customer&apos;s data. See{" "}
        <Link href={docsUrl("/privacy")}>Customer data and privacy</Link>.
      </p>

      <h2>Finance</h2>
      <h3>Payments</h3>
      <p>
        Card payments into your Stripe account, and payment links. Owner only. See{" "}
        <Link href={docsUrl("/payments")}>Deposits and payments</Link>.
      </p>

      <h2>Settings</h2>
      <SimpleTable
        head={["Tab", "What's there"]}
        rows={[
          [
            "General",
            "Your business details, the addresses your booking page is on, a link back to your own website, and connecting Stripe.",
          ],
          [
            "Booking",
            <>
              Mobile and shop, hours, how far you travel, booking rules, and your vans and bays. See{" "}
              <Link href={docsUrl("/availability")}>Hours, vans and travel</Link>.
            </>,
          ],
          [
            "Privacy",
            <>
              Data requests, how long customer data is kept, and your ICO registration. See{" "}
              <Link href={docsUrl("/privacy")}>Customer data and privacy</Link>.
            </>,
          ],
          ["Subscription", "Your plan with us."],
          [
            "API",
            <>
              Keys for your website to read your services and prices. See <Link href={docsUrl("/api")}>the API docs</Link>.
            </>,
          ],
        ]}
      />
      <p>
        <Place>Setup</Place> is the checklist for new businesses. See <Link href={docsUrl("/getting-started")}>Getting started</Link>
        .
      </p>

      <h2 id="roles">Team roles</h2>
      <p>
        Everyone who signs in to your dashboard has a role. You&apos;re the <strong>owner</strong>. We can add{" "}
        <strong>staff</strong> logins for your team: tell us their email address.
      </p>
      <SimpleTable
        head={["", "Owner", "Staff"]}
        rows={[
          ["Calendar, bookings, leads and customers", "Yes", "Yes"],
          ["Mark jobs done, block out time", "Yes", "Yes"],
          ["Income on the overview", "Yes", "No"],
          ["Change services, prices, hours, coverage and settings", "Yes", "No"],
          ["Payments, payment links and refunds", "Yes", "No"],
          ["Download or erase a customer's data", "Yes", "No"],
          ["Connect Stripe, manage the subscription and API keys", "Yes", "No"],
        ]}
      />
      <p>If you look after more than one business, you can switch between them after signing in.</p>
    </>
  );
}
