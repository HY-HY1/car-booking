import type { Metadata } from "next";
import Link from "next/link";
import { DEFAULT_LIMIT, MAX_LIMIT } from "@leadgen/core/api/query";
import { CodeBlock } from "@/components/docs/code-block";
import { Callout, DocTitle, Endpoint, FieldTable, ParamTable, Statuses } from "@/components/docs/docs-kit";
import { exampleCustomer } from "@/lib/docs-examples";
import { apiUrl, docsUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Customers" };

export default function CustomersReference() {
  const list = apiUrl("/v1/customers", { absolute: true });
  const customer = exampleCustomer();

  return (
    <>
      <DocTitle eyebrow="API" title="Customers">
        <p>Read the business&apos;s customers, with their vehicles and what they&apos;ve agreed to be sent.</p>
      </DocTitle>
      <Callout tone="warning">
        <p>
          This is personal data. Keep keys with <code>customers:read</code> on a server you control. Send marketing only
          to customers whose <code>marketing</code> choice for that channel is <code>true</code>.
        </p>
      </Callout>
      <p>
        Customers whose details were erased at their request are left out, as if they&apos;d never existed. Customers
        can&apos;t be changed through the API.
      </p>

      <h2 id="list">List customers</h2>
      <Endpoint method="GET" path={list} scope="customers:read" />
      <p>
        Newest first, a page at a time. See <Link href={docsUrl("/api#pagination")}>pagination</Link>. To find one
        person, filter by email or phone.
      </p>
      <ParamTable
        params={[
          { name: "email", type: "string", text: "Exact email address, any case." },
          { name: "phone", type: "string", text: "Exact phone number. UK numbers can be in any common format, such as 07700 900123." },
          { name: "updatedSince", type: "string", text: "Changed at or after this date-time." },
          { name: "limit", type: "number", text: `How many on a page, 1 to ${MAX_LIMIT}. Default ${DEFAULT_LIMIT}.` },
          { name: "cursor", type: "string", text: "nextCursor from the page before." },
        ]}
      />
      <CodeBlock title="Terminal" code={`curl "${list}?email=sam@example.com" \\\n  -H "Authorization: Bearer $BOOKING_API_KEY"`} />
      <CodeBlock title="200 OK · application/json" code={JSON.stringify({ data: [customer], hasMore: false, nextCursor: null }, null, 2)} />
      <Statuses
        rows={[
          ["200", "A page of customers. It can be empty, for an email nobody has."],
          ["400", <><code>invalid_request</code>: a parameter is wrong. <code>param</code> says which.</>],
          ["401, 403, 429", <Link key="e" href={docsUrl("/api#errors")}>The usual errors</Link>],
        ]}
      />

      <h2 id="get">Get a customer</h2>
      <Endpoint method="GET" path={`${list}/{id}`} scope="customers:read" />
      <p>
        <code>200 OK</code> with the <code>Customer</code>, or <code>404</code> <code>not_found</code>. A booking&apos;s{" "}
        <code>customer.id</code> works here.
      </p>

      <h2 id="customer">Customer</h2>
      <FieldTable
        fields={[
          { name: "id", type: "string", text: "A UUID." },
          { name: "name", type: "string", text: "Their name." },
          { name: "email", type: "string | null", text: "Email address, lower case." },
          { name: "phone", type: "string | null", text: "Phone number in E.164, such as +447700900123." },
          { name: "address.line", type: "string | null", text: "First line of their address." },
          { name: "address.postcode", type: "string | null", text: "Their postcode." },
          {
            name: "source",
            type: "string",
            text: "Where they first came from: booking_page, manual, website, facebook, instagram, phone, referral, google or other.",
          },
          { name: "marketing.email", type: "boolean", text: "Agreed to marketing emails." },
          { name: "marketing.sms", type: "boolean", text: "Agreed to marketing texts." },
          { name: "marketing.whatsapp", type: "boolean", text: "Agreed to marketing on WhatsApp." },
          {
            name: "vehicles",
            type: "{ id, make, model, registration, sizeClass }[]",
            text: "Their cars, oldest first.",
          },
          { name: "createdAt", type: "string", text: "When they were added." },
          { name: "updatedAt", type: "string", text: "When their details last changed." },
        ]}
      />
      <p>The business&apos;s own notes about a customer are never included.</p>
    </>
  );
}
