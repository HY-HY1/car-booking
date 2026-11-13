import type { Metadata } from "next";
import Link from "next/link";
import { DEFAULT_LIMIT, MAX_LIMIT } from "@leadgen/core/api/query";
import { CodeBlock } from "@/components/docs/code-block";
import { Callout, DocTitle, Endpoint, FieldTable, ParamTable, SimpleTable, Statuses } from "@/components/docs/docs-kit";
import { exampleBooking } from "@/lib/docs-examples";
import { apiUrl, docsUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Bookings" };

export default function BookingsReference() {
  const list = apiUrl("/v1/bookings", { absolute: true });
  const booking = exampleBooking();

  return (
    <>
      <DocTitle eyebrow="API" title="Bookings">
        <p>Read the business&apos;s bookings: for a calendar, a CRM, accounts, or reports of its own.</p>
      </DocTitle>
      <Callout tone="warning">
        <p>
          Bookings include customers&apos; names, contact details and addresses. Keep keys with{" "}
          <code>bookings:read</code> on a server you control, and only store what you need.
        </p>
      </Callout>
      <p>
        Bookings can&apos;t be made or changed through the API. Customers book on the booking page, which takes deposits
        and checks the time is still free; the business manages bookings in its dashboard. To hear about changes as they
        happen, use <Link href={docsUrl("/api/webhooks")}>webhooks</Link>.
      </p>

      <h2 id="list">List bookings</h2>
      <Endpoint method="GET" path={list} scope="bookings:read" />
      <p>
        Bookings in the order they happen (by <code>startsAt</code>, earliest first), a page at a time. See{" "}
        <Link href={docsUrl("/api#pagination")}>pagination</Link>.
      </p>
      <h3>Query parameters</h3>
      <ParamTable
        params={[
          {
            name: "status",
            type: "string",
            text: (
              <>
                Only these statuses, comma-separated, such as <code>confirmed,completed</code>. Default: all of them.
              </>
            ),
          },
          {
            name: "from",
            type: "string",
            text: "Starting at or after this. A date (2026-11-20, midnight where the business is) or a date-time with a time zone.",
          },
          { name: "to", type: "string", text: "Starting before this. Same formats as from." },
          {
            name: "updatedSince",
            type: "string",
            text: "Changed at or after this date-time. For keeping a copy in step: remember when you last asked.",
          },
          { name: "customerId", type: "string", text: "One customer's bookings." },
          { name: "limit", type: "number", text: `How many on a page, 1 to ${MAX_LIMIT}. Default ${DEFAULT_LIMIT}.` },
          { name: "cursor", type: "string", text: "nextCursor from the page before." },
        ]}
      />
      <CodeBlock
        title="Terminal: next week's confirmed bookings"
        code={`curl "${list}?status=confirmed&from=2026-11-16&to=2026-11-23" \\\n  -H "Authorization: Bearer $BOOKING_API_KEY"`}
      />
      <h3>Response</h3>
      <CodeBlock
        title="200 OK · application/json"
        code={JSON.stringify({ data: [booking], hasMore: false, nextCursor: null }, null, 2)}
      />
      <Statuses
        rows={[
          ["200", "A page of bookings. It can be empty."],
          ["400", <><code>invalid_request</code>: a parameter is wrong. <code>param</code> says which.</>],
          ["401, 403, 429", <Link key="e" href={docsUrl("/api#errors")}>The usual errors</Link>],
        ]}
      />

      <h2 id="get">Get a booking</h2>
      <Endpoint method="GET" path={`${list}/{id}`} scope="bookings:read" />
      <CodeBlock title="Terminal" code={`curl ${list}/${booking.id} \\\n  -H "Authorization: Bearer $BOOKING_API_KEY"`} />
      <p>
        <code>200 OK</code> with the <code>Booking</code>, or <code>404</code> <code>not_found</code>.
      </p>

      <h2 id="booking">Booking</h2>
      <p>The same object webhooks send as <code>data.booking</code>.</p>
      <FieldTable
        fields={[
          { name: "id", type: "string", text: "A UUID." },
          { name: "reference", type: "string", text: "The short reference the customer sees, such as \"6D1F0C2A\"." },
          { name: "status", type: "BookingStatus", text: <a href="#statuses">See below.</a> },
          { name: "startsAt", type: "string", text: "When it starts, in UTC." },
          { name: "endsAt", type: "string", text: "When it's due to finish, in UTC." },
          { name: "service", type: "{ id, name } | null", text: "The service. Null if it has since been deleted." },
          {
            name: "lines",
            type: "{ label, amountPence }[]",
            text: "The price line by line, as the customer saw it. Empty for some bookings the business added itself.",
          },
          { name: "price.totalPence", type: "number", text: "The total price, in pence." },
          { name: "price.depositPence", type: "number", text: "The deposit, in pence. 0 if none." },
          { name: "price.depositStatus", type: "DepositStatus", text: <a href="#deposit-statuses">See below.</a> },
          { name: "location.type", type: "string", text: "mobile (at the customer's address) or unit (dropped off)." },
          { name: "location.address", type: "string | null", text: "The address line, for mobile jobs." },
          { name: "location.postcode", type: "string", text: "The job's postcode." },
          { name: "customer", type: "{ id, name, email, phone } | null", text: "Who booked. Their id works with /customers/{id}." },
          {
            name: "vehicle",
            type: "{ make, model, registration, sizeClass } | null",
            text: "The car, as the customer described it.",
          },
          { name: "notes", type: "string | null", text: "What the customer wrote. The team's own notes are never included." },
          { name: "vanOrBay", type: "{ id, name } | null", text: "The van or bay the job is on." },
          { name: "staff", type: "{ id, name } | null", text: "Who's doing it, if someone's been given it." },
          {
            name: "source",
            type: "string",
            text: "Where it came from: booking_page, or manual if the business added it.",
          },
          {
            name: "needsInspection",
            type: "boolean",
            text: "True when the business has to check the car before confirming the price.",
          },
          { name: "createdAt", type: "string", text: "When it was made." },
          { name: "updatedAt", type: "string", text: "When anything about it last changed." },
        ]}
      />

      <h3 id="statuses">BookingStatus</h3>
      <SimpleTable
        head={["Status", "Meaning"]}
        rows={[
          [<code key="a">requested</code>, "Waiting for the business to approve it (only if it approves bookings)."],
          [<code key="b">confirmed</code>, "Booked in."],
          [<code key="c">completed</code>, "Done."],
          [<code key="d">cancelled</code>, "Cancelled by the customer or the business, or a request that was declined."],
          [<code key="e">no_show</code>, "The customer wasn't there."],
        ]}
      />
      <p>
        Someone part-way through paying a deposit isn&apos;t a booking yet, so they never appear. Neither does a checkout
        they leave.
      </p>

      <h3 id="deposit-statuses">DepositStatus</h3>
      <SimpleTable
        head={["Status", "Meaning"]}
        rows={[
          [<code key="a">none</code>, "No deposit."],
          [<code key="b">pending</code>, "Due, but not paid yet."],
          [<code key="c">paid</code>, "Paid."],
          [<code key="d">refunded</code>, "Paid, then refunded in full."],
          [<code key="e">partially_refunded</code>, "Paid, then part refunded."],
          [<code key="f">disputed</code>, "The customer has disputed the payment with their bank."],
          [<code key="g">waived</code>, "The business let them off it."],
        ]}
      />
    </>
  );
}
