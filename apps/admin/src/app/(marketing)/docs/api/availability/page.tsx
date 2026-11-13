import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/components/docs/code-block";
import { Callout, DocTitle, Endpoint, FieldTable, ParamTable, Statuses } from "@/components/docs/docs-kit";
import { jobParams } from "@/components/docs/job-params";
import { exampleService } from "@/lib/docs-examples";
import { apiUrl, docsUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Availability" };

export default function AvailabilityReference() {
  const dates = apiUrl("/v1/availability/dates", { absolute: true });
  const slots = apiUrl("/v1/availability/slots", { absolute: true });
  const job = `serviceId=${exampleService.id}&sizeClass=medium&locationType=mobile&postcode=BS7%208QA`;
  const params = jobParams().map((p) =>
    p.name === "postcode"
      ? {
          ...p,
          text: (
            <>
              Where the car will be, as a full UK postcode. <strong>Required for mobile jobs</strong>: free times depend on
              the drive from the job before. Ignored for <code>unit</code>.
            </>
          ),
        }
      : p,
  );

  return (
    <>
      <DocTitle eyebrow="API" title="Availability">
        <p>
          When a job can be booked: which dates have free times, and the free start times on a date. The same answers as
          the booking form&apos;s calendar, so a website can show &quot;next available&quot; or its own date picker.
        </p>
      </DocTitle>
      <p>
        Free times depend on the job, since a longer one fits in fewer gaps, so both endpoints take the same parameters as{" "}
        <Link href={docsUrl("/api/quote")}>a quote</Link>. They account for opening hours, each van&apos;s or bay&apos;s
        bookings, time off, travel between jobs, notice and how far ahead the business takes bookings.
      </p>
      <Callout>
        <p>
          A free time isn&apos;t held for anyone. To book it, send the customer to the booking page (<code>bookUrl</code> in
          the catalogue or a quote): it checks again when they book.
        </p>
      </Callout>

      <h2 id="dates">Dates with free times</h2>
      <Endpoint method="GET" path={dates} scope="catalog:read" />
      <h3>Query parameters</h3>
      <ParamTable params={params} />
      <CodeBlock title="Terminal" code={`curl "${dates}?${job}" \\\n  -H "Authorization: Bearer $BOOKING_API_KEY"`} />
      <h3>Response</h3>
      <CodeBlock
        title="200 OK · application/json"
        code={JSON.stringify(
          { durationMins: 180, timezone: "Europe/London", dates: ["2026-11-17", "2026-11-18", "2026-11-20", "2026-11-21"] },
          null,
          2,
        )}
      />
      <FieldTable
        fields={[
          { name: "durationMins", type: "number", text: "How long the job takes: what the dates were worked out for." },
          { name: "timezone", type: "string", text: "The business's time zone. The dates are days there." },
          {
            name: "dates",
            type: "string[]",
            text: "Every date in the booking window with at least one free start time, earliest first. Empty if none.",
          },
        ]}
      />

      <h2 id="slots">Free times on a date</h2>
      <Endpoint method="GET" path={slots} scope="catalog:read" />
      <h3>Query parameters</h3>
      <ParamTable
        params={[
          { name: "date", type: "string", required: true, text: "The day, such as 2026-11-20, in the business's time zone." },
          ...params,
        ]}
      />
      <CodeBlock title="Terminal" code={`curl "${slots}?date=2026-11-20&${job}" \\\n  -H "Authorization: Bearer $BOOKING_API_KEY"`} />
      <h3>Response</h3>
      <CodeBlock
        title="200 OK · application/json"
        code={JSON.stringify(
          {
            date: "2026-11-20",
            durationMins: 180,
            timezone: "Europe/London",
            slots: [
              { startsAt: "2026-11-20T09:00:00.000Z", time: "09:00" },
              { startsAt: "2026-11-20T09:30:00.000Z", time: "09:30" },
              { startsAt: "2026-11-20T13:30:00.000Z", time: "13:30" },
            ],
          },
          null,
          2,
        )}
      />
      <FieldTable
        fields={[
          { name: "date", type: "string", text: "As sent." },
          { name: "durationMins", type: "number", text: "How long the job takes." },
          { name: "timezone", type: "string", text: "The business's time zone." },
          { name: "slots[].startsAt", type: "string", text: "The start, in UTC." },
          { name: "slots[].time", type: "string", text: "The same start as local time, \"HH:MM\", for showing." },
        ]}
      />
      <p>A date outside the booking window, or one that&apos;s full, gives an empty list rather than an error.</p>

      <h2>Statuses</h2>
      <Statuses
        rows={[
          ["200", "The dates or times."],
          ["400", <><code>invalid_request</code>: a parameter is missing or wrong. <code>param</code> says which.</>],
          [
            "422",
            <>
              <code>postcode_required</code> for a mobile job without a postcode, and the same errors as a quote:{" "}
              <code>unknown_service</code>, <code>unknown_add_on</code>, <code>add_on_not_for_service</code>,{" "}
              <code>location_not_offered</code>.
            </>,
          ],
          ["409", <code key="n">not_set_up</code>],
          ["401, 403, 429", <Link key="e" href={docsUrl("/api#errors")}>The usual errors</Link>],
        ]}
      />
      <p>
        Working out free times takes a moment longer than other requests. Fetch them when a visitor asks, not on every
        page view, and not ahead of time for every service.
      </p>
    </>
  );
}
