import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/components/docs/code-block";
import { Callout, DocTitle, Endpoint, FieldTable, ParamTable, Statuses } from "@/components/docs/docs-kit";
import { jobParams } from "@/components/docs/job-params";
import { exampleAddOn, exampleApiQuote, exampleService } from "@/lib/docs-examples";
import { apiUrl, docsUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Get a quote" };

export default function QuoteReference() {
  const endpoint = apiUrl("/v1/quote", { absolute: true });
  const query = `serviceId=${exampleService.id}&sizeClass=large&locationType=unit&addOnIds=${exampleAddOn.id}`;

  return (
    <>
      <DocTitle eyebrow="API" title="Get a quote">
        <p>
          The price of a job, line by line, worked out by the same engine as the booking form, with the deposit and how
          long it takes.
        </p>
      </DocTitle>

      <Endpoint method="GET" path={endpoint} scope="catalog:read" />

      <h2>Query parameters</h2>
      <ParamTable params={jobParams()} />
      <CodeBlock title="Terminal" code={`curl "${endpoint}?${query}" \\\n  -H "Authorization: Bearer $BOOKING_API_KEY"`} />

      <h2>Response</h2>
      <p>
        <code>200 OK</code> with a <code>Quote</code>. A large car at the premises, with pet hair removal:
      </p>
      <CodeBlock title="200 OK · application/json" code={JSON.stringify(exampleApiQuote(), null, 2)} />
      <Statuses
        rows={[
          ["200", "The quote."],
          ["400", <><code>invalid_request</code>: a parameter is missing or wrong. <code>param</code> says which.</>],
          [
            "422",
            <>
              <code>unknown_service</code>, <code>unknown_add_on</code>, <code>add_on_not_for_service</code> or{" "}
              <code>location_not_offered</code>.
            </>,
          ],
          ["409", <code key="n">not_set_up</code>],
          ["401, 403, 429", <Link key="e" href={docsUrl("/api#errors")}>The usual errors</Link>],
        ]}
      />

      <h2 id="quote">Quote</h2>
      <FieldTable
        fields={[
          { name: "serviceId", type: "string", text: "The service quoted for." },
          { name: "serviceName", type: "string", text: "Its name." },
          { name: "sizeClass", type: "string", text: "As sent." },
          { name: "locationType", type: "string", text: "As sent." },
          { name: "addOnIds", type: "string[]", text: "The extras included." },
          {
            name: "lines",
            type: "{ label, amountPence }[]",
            text: "The price line by line, as the booking form shows it: the service, size, extras, call-out or travel fee, and any minimum-price top-up.",
          },
          { name: "totalPence", type: "number", text: "The total, in pence." },
          { name: "total", type: "string", text: "The same, formatted, such as \"£120\"." },
          { name: "depositPence", type: "number", text: "What's paid when booking. 0 if no deposit." },
          { name: "deposit", type: "string", text: "The same, formatted." },
          { name: "durationMins", type: "number", text: "How long the job takes, including the size and extras." },
          {
            name: "needsInspection",
            type: "boolean",
            text: "True when the business checks the car's condition before confirming the price. See below.",
          },
          {
            name: "bookUrl",
            type: "string | null",
            text: "Opens the booking form with this service chosen.",
          },
        ]}
      />
      <Callout>
        <p>
          On the booking form, customers can send photos so the business&apos;s condition levels can be applied up
          front. The API can&apos;t take photos, so its quote is the price for a car in normal condition. When the
          business uses condition levels, <code>needsInspection</code> is true and the final price may be higher if the
          car needs more work. Show it as a guide, such as &quot;from £120&quot;.
        </p>
      </Callout>
    </>
  );
}
