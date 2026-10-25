import type { Metadata } from "next";
import Link from "next/link";
import { MAX_TERRITORIES } from "@leadgen/core/booking/config";
import { estimateDriveMins } from "@leadgen/core/booking/geo";
import { MIN_ONLINE_HOLD_MINUTES } from "@leadgen/core/stripe/rules";
import { Callout, DocTitle, Place, SimpleTable } from "@/components/docs/docs-kit";
import { docsUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Hours, vans and travel" };

export default function Availability() {
  return (
    <>
      <DocTitle eyebrow="How it works" title="Hours, vans and travel">
        <p>
          How the booking page decides which times to offer, so you&apos;re never double-booked or late because of the
          drive.
        </p>
      </DocTitle>

      <p>
        These settings are under <Place>Settings → Booking</Place>, apart from map territories, which are under{" "}
        <Place>Coverage Area</Place>. Only the business owner can change them.
      </p>

      <h2>Working hours</h2>
      <p>
        Set the hours you take jobs for each day of the week. A day can have more than one stretch, for example 8:00 to
        12:00 and 13:00 to 18:00 with a break for lunch. A day with no hours is closed.
      </p>
      <ul>
        <li>
          <strong>Mobile hours</strong> are when you work at customers&apos; addresses.
        </li>
        <li>
          <strong>Shop hours</strong> are when your unit takes drop-offs. Unless you set them separately, they&apos;re
          the same as your mobile hours.
        </li>
      </ul>
      <p>A job has to start and finish inside your hours, so a 4-hour job won&apos;t be offered at 16:00 if you close at 18:00.</p>

      <h2>Vans and bays</h2>
      <p>
        A van (or a bay at your unit, or a person who does both) is anything that does one job at a time. Every business
        has at least one. Add more and you can take that many jobs at once.
      </p>
      <ul>
        <li>
          Each one says whether it goes <strong>out on mobile jobs</strong>, works <strong>at the shop</strong>, or both.
        </li>
        <li>
          Each one can have <strong>its own hours</strong>. Otherwise it uses your mobile or shop hours.
        </li>
        <li>
          Switch one off (<strong>Taking bookings</strong>) and it stops being offered, without losing its jobs.
        </li>
      </ul>
      <p>
        A time is offered if <em>any</em> suitable van or bay is free then. The booking goes to the first free one, in
        the order you&apos;ve set. You can see each van&apos;s jobs side by side in the <Place>Calendar</Place>.
      </p>
      <Callout>
        <p>
          If you switch off mobile jobs, or have no active van that goes out, customers aren&apos;t offered &quot;at my
          address&quot;. The same goes for drop-offs and the shop.
        </p>
      </Callout>

      <h2 id="travel">Travel between jobs</h2>
      <p>
        Mobile jobs need time to drive between them. For each possible time, the gap kept between two jobs on the same
        van is the <strong>larger</strong> of:
      </p>
      <ul>
        <li>
          your <Place>Minimum gap between mobile jobs</Place>, and
        </li>
        <li>an estimate of the drive from one job&apos;s postcode to the other&apos;s.</li>
      </ul>
      <p>
        The drive is estimated from the straight-line distance between postcodes, allowing for roads winding and an
        average van speed, rounded up to the next 5 minutes. As a rough guide, 5 miles apart is about{" "}
        {estimateDriveMins(5)} minutes and 15 miles is about {estimateDriveMins(15)}. If a postcode can&apos;t be looked
        up, your minimum gap is used on its own.
      </p>
      <p>
        Two jobs at your unit don&apos;t need a drive, so they&apos;re spaced by <Place>Gap between shop jobs</Place>{" "}
        instead: time to turn the bay round.
      </p>

      <h2>Booking rules</h2>
      <SimpleTable
        head={["Setting", "What it does"]}
        rows={[
          ["Start times every (minutes)", "How far apart the start times are, e.g. every 30 minutes: 8:00, 8:30, 9:00."],
          ["Notice needed (hours)", "How soon a customer can book. With 24, nobody can book a job for later today."],
          ["Book up to (days ahead)", "How far into the future your calendar is open."],
          [
            "Hold a slot while paying (minutes)",
            `How long a time is held while the customer pays the deposit. At least ${MIN_ONLINE_HOLD_MINUTES} minutes when they pay online, whatever this says.`,
          ],
          ["Minimum gap between mobile jobs", "The least time kept between two jobs on one van. See above."],
          ["Gap between shop jobs", "Turnaround time between two jobs in the same bay."],
        ]}
      />

      <h2>Blocking out time</h2>
      <p>
        For holidays, the van&apos;s MOT or a job you took over the phone, use <Place>Block out time</Place> in the{" "}
        <Place>Calendar</Place>. Block the whole business, or just one van or bay. Blocked time is never offered to
        customers. Unlike a job, it doesn&apos;t need a travel gap either side.
      </p>

      <h2 id="coverage">Coverage area</h2>
      <p>Choose how far you&apos;ll travel for mobile jobs. Customers outside it can&apos;t book a job at their address.</p>
      <SimpleTable
        head={["Option", "How it works"]}
        rows={[
          ["Anywhere", "No limit."],
          ["Within a distance", "A number of miles, as the crow flies, from where your vans start."],
          ["Postcode districts", "A list like BS1, BS16, BA2. The first half of the customer's postcode must be on it."],
          [
            "Territories",
            <>
              Up to {MAX_TERRITORIES} circles you draw and resize on a map under <Place>Coverage Area</Place>, such as one
              round each town you cover. A customer inside any of them can book.
            </>,
          ],
        ]}
      />
      <p>
        Customers dropping their car at your unit aren&apos;t checked against your coverage area. See also{" "}
        <Link href={docsUrl("/booking-flow")}>How customers book</Link>.
      </p>
    </>
  );
}
