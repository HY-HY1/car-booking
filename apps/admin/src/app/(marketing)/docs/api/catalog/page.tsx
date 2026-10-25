import type { Metadata } from "next";
import Link from "next/link";
import { SIZE_CLASSES } from "@leadgen/core/booking/config";
import { CodeBlock } from "@/components/docs/code-block";
import { Callout, DocTitle, Endpoint, FieldTable, SimpleTable } from "@/components/docs/docs-kit";
import { exampleCatalog } from "@/lib/docs-examples";
import { apiUrl, docsUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Get the catalogue" };

export default function CatalogReference() {
  const endpoint = apiUrl("/v1/catalog", { absolute: true });
  const sizes = Object.keys(SIZE_CLASSES).map((s) => `"${s}"`).join(", ");

  return (
    <>
      <DocTitle eyebrow="API" title="Get the catalogue">
        <p>
          Returns everything a business sells: its active services with prices and page content, and its extras.
        </p>
      </DocTitle>

      <Endpoint method="GET" path={endpoint} />

      <h2>Request</h2>
      <SimpleTable
        head={["Header", "Required", "Value"]}
        rows={[
          [<code key="a">Authorization</code>, "Yes", <code key="b">Bearer ascnd_…</code>],
          [
            <code key="c">If-None-Match</code>,
            "No",
            <>
              The <code>ETag</code> from your last response. Gets a <code>304</code> with no body if nothing changed.
            </>,
          ],
        ]}
      />
      <p>There are no query parameters. The key decides which business is returned.</p>
      <CodeBlock title="Terminal" code={`curl ${endpoint} \\\n  -H "Authorization: Bearer $BOOKING_API_KEY"`} />

      <h2>Response</h2>
      <p>
        <code>200 OK</code> with the catalogue below. For example, for a business with one service and one extra:
      </p>
      <CodeBlock title="200 OK · application/json" code={JSON.stringify(exampleCatalog(), null, 2)} />

      <SimpleTable
        head={["Status", "When"]}
        rows={[
          ["200", "The catalogue, with an ETag header."],
          ["304", "You sent If-None-Match and nothing has changed. No body."],
          [
            "401",
            <>
              <code>missing_key</code> or <code>invalid_key</code>. See <Link href={docsUrl("/api#errors")}>Errors</Link>.
            </>,
          ],
          ["500", <code key="e">server_error</code>],
        ]}
      />

      <h2 id="catalog">The catalogue</h2>
      <FieldTable
        fields={[
          { name: "version", type: "1", text: "Always 1 on this endpoint. See versioning." },
          { name: "business.name", type: "string", text: "The business's name." },
          {
            name: "business.bookingUrl",
            type: "string | null",
            text: "The business's booking site. Null until its booking address is set up.",
          },
          { name: "services", type: "Service[]", text: "Active services, in the order the business has arranged them." },
          { name: "addOns", type: "AddOn[]", text: "Active extras, in the business's order." },
        ]}
      />
      <p>
        Switched-off services and extras are left out, so the lists can be empty. Handle that rather than assuming
        there&apos;s at least one.
      </p>

      <h2 id="service">Service</h2>
      <FieldTable
        fields={[
          { name: "id", type: "string", text: "A UUID. Stable: use it to match services between fetches." },
          {
            name: "slug",
            type: "string | null",
            text: "URL-friendly name, such as \"full-valet\". Null if the service has no page of its own.",
          },
          { name: "name", type: "string", text: "Display name." },
          { name: "tagline", type: "string | null", text: "A short line to show under the name." },
          { name: "description", type: "string | null", text: "A sentence or two for lists and cards." },
          { name: "badge", type: "string | null", text: "A label to highlight it, such as \"Most popular\"." },
          {
            name: "durationMins",
            type: "number",
            text: "How long it takes in minutes, before any extra time for a bigger vehicle.",
          },
          {
            name: "locations",
            type: "string[]",
            text: (
              <>
                Where it can be done: <code>&quot;mobile&quot;</code> (at the customer&apos;s address) and/or{" "}
                <code>&quot;unit&quot;</code> (dropped off).
              </>
            ),
          },
          { name: "price", type: "Price", text: <a href="#price">See below.</a> },
          { name: "image", type: "string | null", text: "Full URL of the main photo." },
          { name: "gallery", type: "string[]", text: "Full URLs of more photos." },
          { name: "includes", type: "string[]", text: "What's included, one item per entry." },
          { name: "notIncluded", type: "string[]", text: "What isn't." },
          { name: "steps", type: "{ title, text }[]", text: "The steps of the job, in order." },
          { name: "faqs", type: "{ q, a }[]", text: "Questions and answers." },
          {
            name: "body",
            type: "string | null",
            text: "Longer text for the service's page. Plain text: paragraphs are separated by blank lines.",
          },
          {
            name: "seo",
            type: "{ title, description }",
            text: "For the page's <title> and meta description. Either can be null: fall back to the name and description.",
          },
          {
            name: "pageUrl",
            type: "string | null",
            text: "The service's page on the booking site. Null without a slug or a booking address.",
          },
          {
            name: "bookUrl",
            type: "string | null",
            text: "Opens the booking form with this service already chosen, so the customer starts at the next step. Use it for \"Book now\" buttons. It uses the service id, so it keeps working if the service is renamed. Null without a booking address.",
          },
        ]}
      />

      <h3 id="price">Price</h3>
      <FieldTable
        fields={[
          { name: "fromPence", type: "number", text: "The base price in pence: the least it costs." },
          { name: "from", type: "string", text: "The same, formatted, such as \"£85\". Show it as \"from £85\"." },
          {
            name: "bySize",
            type: "SizePrice[]",
            text: "Extra price and time for bigger vehicles. Sizes that cost nothing extra are left out.",
          },
          { name: "bySize[].size", type: "string", text: <>One of {sizes}.</> },
          { name: "bySize[].label", type: "string", text: "A description to show, with example models." },
          { name: "bySize[].extraPence", type: "number", text: "Added to fromPence for that size." },
          { name: "bySize[].extraMins", type: "number", text: "Added to durationMins for that size." },
        ]}
      />
      <Callout>
        <p>
          The final price also depends on things only the booking form asks, such as the car&apos;s condition, extras
          and a mobile call-out fee. Show catalogue prices as &quot;from&quot;, and link to <code>bookUrl</code> for an
          exact quote.
        </p>
      </Callout>

      <h2 id="add-on">AddOn</h2>
      <FieldTable
        fields={[
          { name: "id", type: "string", text: "A UUID." },
          { name: "name", type: "string", text: "Display name." },
          { name: "description", type: "string | null", text: "A short description." },
          { name: "pricePence", type: "number", text: "Price in pence." },
          { name: "price", type: "string", text: "The same, formatted, such as \"£15.50\"." },
          { name: "durationMins", type: "number", text: "Time it adds, in minutes." },
          {
            name: "serviceIds",
            type: "string[] | null",
            text: "The ids of the services it can be added to. Null means every service.",
          },
        ]}
      />
    </>
  );
}
