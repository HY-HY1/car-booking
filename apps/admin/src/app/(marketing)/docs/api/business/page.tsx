import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/components/docs/code-block";
import { DocTitle, Endpoint, FieldTable, Statuses } from "@/components/docs/docs-kit";
import { exampleBusiness } from "@/lib/docs-examples";
import { apiUrl, docsUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Get the business" };

export default function BusinessReference() {
  const endpoint = apiUrl("/v1/business", { absolute: true });

  return (
    <>
      <DocTitle eyebrow="API" title="Get the business">
        <p>
          The business&apos;s name, contact details, branding, where and when it works, and its booking rules: what a
          website needs for its header, footer and contact page.
        </p>
      </DocTitle>

      <Endpoint method="GET" path={endpoint} scope="catalog:read" />

      <h2>Request</h2>
      <p>No parameters. The key decides which business.</p>
      <CodeBlock title="Terminal" code={`curl ${endpoint} \\\n  -H "Authorization: Bearer $BOOKING_API_KEY"`} />

      <h2>Response</h2>
      <p>
        <code>200 OK</code> with a <code>Business</code>:
      </p>
      <CodeBlock title="200 OK · application/json" code={JSON.stringify(exampleBusiness, null, 2)} />
      <Statuses
        rows={[
          ["200", "The business."],
          ["401", <><code>missing_key</code> or <code>invalid_key</code>.</>],
          ["403", <code key="s">insufficient_scope</code>],
          ["429", <code key="r">rate_limited</code>],
        ]}
      />

      <h2 id="business">Business</h2>
      <FieldTable
        fields={[
          { name: "name", type: "string", text: "The business's name." },
          { name: "tagline", type: "string | null", text: "A short line about it, as on its booking page." },
          { name: "bookingUrl", type: "string | null", text: "Its booking site. Link \"Book now\" buttons here." },
          { name: "websiteUrl", type: "string | null", text: "Its own website, if it gave one." },
          { name: "contact.email", type: "string | null", text: "Email address for customers." },
          { name: "contact.phone", type: "string | null", text: "Phone number for customers, in E.164 (+44…)." },
          { name: "branding.logoUrl", type: "string | null", text: "Full URL of its logo." },
          { name: "branding.coverUrl", type: "string | null", text: "Full URL of the photo behind its booking page's heading." },
          { name: "branding.primaryColor", type: "string", text: "Main brand colour, \"#rrggbb\"." },
          { name: "branding.accentColor", type: "string", text: "Button colour, \"#rrggbb\"." },
          { name: "locations.mobile", type: "boolean", text: "True if it comes to customers' homes and workplaces." },
          {
            name: "locations.unit",
            type: "{ address, postcode } | null",
            text: "Its premises, where customers drop cars off. Null if it doesn't take cars in.",
          },
          {
            name: "openingHours.mobile",
            type: "OpeningHours | null",
            text: "When it works at customers' addresses. Null if it doesn't.",
          },
          {
            name: "openingHours.unit",
            type: "OpeningHours | null",
            text: "When its premises are open. Null if it has none.",
          },
          {
            name: "booking.approvalRequired",
            type: "boolean",
            text: "True when the business approves each booking before it's confirmed.",
          },
          { name: "booking.minNoticeHours", type: "number", text: "The earliest a booking can be, in hours from now." },
          { name: "booking.maxDaysAhead", type: "number", text: "How far ahead customers can book, in days." },
          { name: "booking.deposit", type: "Deposit", text: <a href="#deposit">See below.</a> },
          { name: "links.terms", type: "string | null", text: "Its booking terms." },
          { name: "links.privacy", type: "string | null", text: "Its privacy notice." },
          { name: "timezone", type: "string", text: "IANA time zone, such as \"Europe/London\". Plain dates in the API are days here." },
          { name: "currency", type: "\"GBP\"", text: "Always GBP." },
        ]}
      />

      <h3 id="opening-hours">OpeningHours</h3>
      <p>
        An object with every day from <code>monday</code> to <code>sunday</code>. Each is a list of{" "}
        <code>{"{ opens, closes }"}</code> in 24-hour <code>&quot;HH:MM&quot;</code>, local time. A closed day is an empty
        list, and a day with a break has two entries.
      </p>
      <p>
        These are the normal weekly hours. Holidays and fully booked days aren&apos;t in them: for those, use{" "}
        <Link href={docsUrl("/api/availability")}>availability</Link>.
      </p>

      <h3 id="deposit">Deposit</h3>
      <FieldTable
        fields={[
          { name: "{ type: \"none\" }", type: "", text: "Nothing to pay when booking." },
          { name: "{ type: \"percent\", percent }", type: "number", text: "That percentage of the price, such as 25." },
          { name: "{ type: \"fixed\", amountPence }", type: "number", text: "A set amount, in pence." },
          { name: "{ type: \"full\" }", type: "", text: "The whole price is paid when booking." },
        ]}
      />
    </>
  );
}
