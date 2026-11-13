import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/components/docs/code-block";
import { DocTitle, Endpoint, FieldTable, ParamTable, Statuses } from "@/components/docs/docs-kit";
import { apiUrl, docsUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Check the service area" };

export default function ServiceAreaReference() {
  const endpoint = apiUrl("/v1/service-area", { absolute: true });

  return (
    <>
      <DocTitle eyebrow="API" title="Check the service area">
        <p>Whether a mobile business comes out to a postcode: for a &quot;Do we cover you?&quot; box on a website.</p>
      </DocTitle>

      <Endpoint method="GET" path={endpoint} scope="catalog:read" />

      <h2>Query parameters</h2>
      <ParamTable
        params={[{ name: "postcode", type: "string", required: true, text: "A full UK postcode, in any case, with or without the space." }]}
      />
      <CodeBlock title="Terminal" code={`curl "${endpoint}?postcode=bs78qa" \\\n  -H "Authorization: Bearer $BOOKING_API_KEY"`} />

      <h2>Response</h2>
      <CodeBlock title="200 OK · covered" code={JSON.stringify({ postcode: "BS7 8QA", covered: true, message: null }, null, 2)} />
      <CodeBlock
        title="200 OK · not covered"
        code={JSON.stringify(
          {
            postcode: "EH1 1YZ",
            covered: false,
            message: "Sorry, that's outside the area we cover. Get in touch and we'll see what we can do.",
          },
          null,
          2,
        )}
      />
      <FieldTable
        fields={[
          { name: "postcode", type: "string", text: "The postcode, tidied: upper case with one space." },
          { name: "covered", type: "boolean", text: "True if the business comes out to it." },
          {
            name: "message",
            type: "string | null",
            text: "When it isn't covered, why, written for the customer. Null when it is.",
          },
        ]}
      />
      <p>
        A business that only takes cars in at its premises covers nowhere, and the message says to drop the car off
        instead. A postcode that doesn&apos;t exist is an error, not <code>covered: false</code>.
      </p>
      <Statuses
        rows={[
          ["200", "The answer."],
          ["400", <><code>invalid_request</code>: no postcode, or not a UK one.</>],
          ["422", <><code>unknown_postcode</code>: it&apos;s the right shape, but doesn&apos;t exist.</>],
          ["409", <code key="n">not_set_up</code>],
          ["401, 403, 429", <Link key="e" href={docsUrl("/api#errors")}>The usual errors</Link>],
        ]}
      />
    </>
  );
}
