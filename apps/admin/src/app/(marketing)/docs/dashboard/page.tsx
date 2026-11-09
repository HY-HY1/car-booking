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
        The menu is grouped the same way as this page. On a phone it&apos;s the tabs along the bottom, with the rest under{" "}
        <Place>More</Place>. The search box at the top of every page finds customers, bookings and leads by
        name, email, phone or postcode, and jumps to any dashboard page by name.
      </p>

      <h2>Day to day</h2>
      <h3>Overview</h3>
      <p>
        How the business is doing. Switch between day, week, month and year, and step back through earlier periods.
        You&apos;ll see jobs and income against the period before, charts of both, what&apos;s coming up next and your
        most-booked services. Income is shown to the owner only.
      </p>

      <h3>Diary</h3>
      <p>Your diary, by day or by week.</p>
      <ul>
        <li>The day view has a column for each van or bay. The week view can be filtered to one.</li>
        <li>Jobs are coloured by status, and blocked-out time is shaded.</li>
        <li>The estimated drive between one mobile job and the next is shown in the gap.</li>
        <li>
          Click a job to see its details and mark it <strong>completed</strong>, a <strong>no-show</strong> or{" "}
          <strong>cancelled</strong>. Put it back if you change your mind, or switch done and no-show if you picked the
          wrong one. The same buttons are on the booking&apos;s own page.
        </li>
        <li>
          On a phone the diary is a list of the day&apos;s jobs, each with buttons to call, text or navigate to the
          customer.
        </li>
        <li>
          Drag a job to move it to another time, day or van, or use <Place>Change date or time</Place> on the job. You
          can email the customer the new time as you do it. Confirmed jobs and requests can be moved; you can go outside
          your hours or into time off, but not on top of another job on the same van.
        </li>
        <li>Click an empty slot to add a booking at that time.</li>
        <li>
          A booking awaiting its deposit can be <strong>confirmed</strong> by hand, if they&apos;ve paid you
          another way or you&apos;ll take the deposit later. They get their confirmation email, and the deposit stays
          owed.
        </li>
        <li>
          <Place>Add booking</Place> puts in a booking you&apos;ve taken yourself, on the phone or in person. Pick the
          customer, service, car size, extras, where and when; the price comes from your price list, and you can change
          the price, the length and the deposit. You can book outside your hours or in time off, but not on top of
          another job on the same van. <Place>Book again</Place> on a customer&apos;s page fills in their details.
        </li>
        <li>
          When a booking&apos;s deposit is still owed, <Place>Email deposit request</Place> sends the customer a
          button to pay it by card from their booking page (Stripe has to be connected). Once they pay, the deposit
          shows as paid.
        </li>
        <li>
          <Place>Block out time</Place> stops customers booking a stretch of time, for the whole business or one van.
        </li>
      </ul>

      <h3>Bookings</h3>
      <p>
        Every booking, with its status and deposit. Open one to see everything the customer told you, their photos, the
        price breakdown and the payment, and to refund the deposit. Paid in cash or by bank transfer?{" "}
        <Place>Record payment</Place> adds it to the booking: it counts towards what&apos;s paid and towards your
        income, and if it covers a deposit that wasn&apos;t paid online, the deposit shows as paid. One added by mistake
        can be removed.
        A booking is one of:
      </p>
      <SimpleTable
        head={["Status", "Meaning"]}
        rows={[
          ["Awaiting deposit", "The customer is paying the deposit right now. The time is reserved for a short while."],
          ["Confirmed", "Booked. It's in your calendar."],
          ["Completed", "You've done the job."],
          ["No-show", "The customer wasn't there or didn't bring the car."],
          ["Awaiting approval", "Waiting for you to approve it, if you approve each booking yourself."],
          ["Cancelled", "Called off, by you or the customer. The booking shows which, and when."],
        ]}
      />

      <h3>Leads</h3>
      <p>
        Everyone who gave their contact details on your booking page, including the ones who didn&apos;t book. Each
        lead keeps the quote they saw and their answers, so you can call them back knowing what they wanted. See{" "}
        <Link href={docsUrl("/booking-flow#leads")}>Leads</Link>.
      </p>

      <h2>Your business</h2>
      <h3>Pricing</h3>
      <p>
        Your services, extras, condition levels, deposit, minimum charge and call-out fee, plus each service&apos;s page
        content and photos. See <Link href={docsUrl("/pricing")}>Services and pricing</Link>.
      </p>
      <h3>Coverage area</h3>
      <p>
        A map of where you&apos;ll travel, with circles you can drag and resize. See{" "}
        <Link href={docsUrl("/availability#coverage")}>Coverage area</Link>.
      </p>
      <h3>Team</h3>
      <p>
        Two tabs. <Place>Staff</Place> lists the people who do the work: name, job title, contact details, notes, and the
        van and territory they&apos;re usually on. It&apos;s a record for you and doesn&apos;t give anyone a login.{" "}
        <Place>Logins &amp; access</Place> is who can sign in to the dashboard and what they can do. See{" "}
        <a href="#roles">Team roles</a>.
      </p>

      <h3>Customers</h3>
      <p>
        Everyone who has booked or enquired, plus anyone you add yourself with <Place>Add customer</Place>. A
        customer&apos;s page shows their contact details, vehicles, photos, past and upcoming jobs, and whether
        they&apos;ve agreed to marketing. The owner can also download or erase a customer&apos;s data. See{" "}
        <Link href={docsUrl("/privacy")}>Customer data and privacy</Link>.
      </p>

      <h3>Payments</h3>
      <p>
        Card payments into your Stripe account, and payment links. Owner only. See{" "}
        <Link href={docsUrl("/payments")}>Deposits and payments</Link>.
      </p>

      <h2>Settings</h2>
      <SimpleTable
        head={["Page", "What's there"]}
        rows={[
          ["Business details", "Your business's name, contact details and time zone."],
          [
            "Privacy & data",
            <>
              Data requests, how long customer data is kept, and your ICO registration. See{" "}
              <Link href={docsUrl("/privacy")}>Customer data and privacy</Link>.
            </>,
          ],
          ["Billing", "Your plan with us."],
          [
            "Hours & rules",
            <>
              Mobile and shop, hours, how far you travel, booking rules, and your vans and bays. See{" "}
              <Link href={docsUrl("/availability")}>Hours, vans and travel</Link>.
            </>,
          ],
          ["Booking page", "How your booking page looks, the addresses it's on, a link back to your own website, and the button for your site."],
          ["Payments", "Connecting Stripe, and what happens to deposits."],
          ["Notifications", "The emails customers get, and the alerts you get."],
          [
            "Integrations",
            <>
              Google Calendar, and keys for your website to read your services and prices. See{" "}
              <Link href={docsUrl("/api")}>the API docs</Link>.
            </>,
          ],
          ["Your account", "Your own name, email and password."],
        ]}
      />
      <p>
        <Place>Setup</Place> is the checklist for new businesses. It leaves the menu once the steps are done, and search still
        finds it. See <Link href={docsUrl("/getting-started")}>Getting started</Link>.
      </p>

      <h2 id="roles">Team roles</h2>
      <p>
        Everyone who signs in to your dashboard has a role. You&apos;re the <strong>owner</strong>. Add logins for your team under{" "}
        <Place>Team → Logins &amp; access</Place>.
      </p>
      <SimpleTable
        head={["", "Owner", "Staff"]}
        rows={[
          ["Diary, bookings, leads and customers", "Yes", "Yes"],
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
