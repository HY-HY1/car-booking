import type { Metadata } from "next";
import Link from "next/link";
import { DEFAULT_LIMIT, MAX_LIMIT } from "@leadgen/core/api/query";
import { CodeBlock } from "@/components/docs/code-block";
import { Callout, DocTitle, Endpoint, FieldTable, ParamTable, SimpleTable, Statuses } from "@/components/docs/docs-kit";
import { exampleLead, exampleService } from "@/lib/docs-examples";
import { apiUrl, docsUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Enquiries (leads)" };

export default function LeadsReference() {
  const list = apiUrl("/v1/leads", { absolute: true });
  const lead = exampleLead();
  const body = {
    name: "Sam Price",
    email: "sam@example.com",
    phone: "07700 900123",
    postcode: "bs7 8qa",
    message: "Can you do a full valet on a 7-seater next week?",
    serviceId: exampleService.id,
    answers: [{ question: "Best time to call", answer: "Evenings" }],
    formName: "Contact page",
    externalId: "contact-2291",
  };

  return (
    <>
      <DocTitle eyebrow="API" title="Enquiries (leads)">
        <p>
          People who&apos;ve been in touch but haven&apos;t booked. Read them, or send in enquiries from a form on the
          business&apos;s own website so they land in its dashboard with the rest.
        </p>
      </DocTitle>
      <p>
        An enquiry is made when someone gives their details on the booking page without finishing, fills in a Facebook
        or Instagram lead form, or is sent in through this API. It moves to <code>booked</code> when they book.
      </p>

      <h2 id="create">Add an enquiry</h2>
      <Endpoint method="POST" path={list} scope="leads:write" />
      <p>
        For the contact form on the business&apos;s website. Post the form to your own server, check it there (a spam
        check is worth having), then send it on from the server. The business sees it under <strong>Leads</strong>,
        with the answers, and any <code>lead.created</code> webhooks fire.
      </p>
      <h3>Body</h3>
      <ParamTable
        params={[
          { name: "name", type: "string", required: true, text: "Their name. Up to 200 characters." },
          { name: "email", type: "string", text: "Their email address. Send email or phone, or both." },
          { name: "phone", type: "string", text: "Their phone number. UK numbers can be in any common format." },
          { name: "postcode", type: "string", text: "Where they are." },
          { name: "message", type: "string", text: "What they wrote. Shown first, as \"Message\". Up to 5,000 characters." },
          { name: "serviceId", type: "string", text: "A service from the catalogue, if your form asks which." },
          {
            name: "answers",
            type: "{ question, answer }[]",
            text: "Any other questions on your form, in order. Up to 30.",
          },
          { name: "formName", type: "string", text: "Which form it came from, such as \"Contact page\". Default \"Website form\"." },
          {
            name: "externalId",
            type: "string",
            text: "Your own id for this submission. If you send the same one again (a retry, say), you get the first enquiry back instead of a second one.",
          },
        ]}
      />
      <CodeBlock
        title="Terminal"
        code={`curl ${list} \\\n  -H "Authorization: Bearer $BOOKING_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(body)}'`}
      />
      <h3>Response</h3>
      <p>
        <code>201 Created</code> with the new <code>Lead</code>, or <code>200 OK</code> with the earlier one when the{" "}
        <code>externalId</code> was sent before.
      </p>
      <CodeBlock title="201 Created · application/json" code={JSON.stringify(lead, null, 2)} />
      <Statuses
        rows={[
          ["201", "Added."],
          ["200", "Already added with that externalId: the first one."],
          ["400", <><code>invalid_request</code>: a field is missing or wrong. <code>param</code> says which.</>],
          ["422", <><code>unknown_service</code>: the serviceId isn&apos;t one of the business&apos;s services.</>],
          ["401, 403, 429", <Link key="e" href={docsUrl("/api#errors")}>The usual errors</Link>],
        ]}
      />
      <Callout>
        <p>
          If the email or phone number belongs to an existing customer, the enquiry is added to them; otherwise a new
          customer is made. Nobody is signed up to marketing this way: the business can only send them marketing once
          they opt in on its own booking page.
        </p>
      </Callout>

      <h2 id="list">List enquiries</h2>
      <Endpoint method="GET" path={list} scope="leads:read" />
      <p>
        Newest first, a page at a time. See <Link href={docsUrl("/api#pagination")}>pagination</Link>.
      </p>
      <ParamTable
        params={[
          { name: "status", type: "string", text: "Only these statuses, comma-separated: new, quoted, booked, lost." },
          { name: "source", type: "string", text: "Only from one source, such as website." },
          { name: "customerId", type: "string", text: "One customer's enquiries." },
          { name: "createdSince", type: "string", text: "Made at or after this date-time." },
          { name: "updatedSince", type: "string", text: "Changed at or after this date-time." },
          { name: "limit", type: "number", text: `How many on a page, 1 to ${MAX_LIMIT}. Default ${DEFAULT_LIMIT}.` },
          { name: "cursor", type: "string", text: "nextCursor from the page before." },
        ]}
      />
      <CodeBlock title="Terminal" code={`curl "${list}?status=new,quoted" \\\n  -H "Authorization: Bearer $BOOKING_API_KEY"`} />
      <p>
        <code>200 OK</code> with <code>{"{ data: Lead[], hasMore, nextCursor }"}</code>.
      </p>

      <h2 id="get">Get an enquiry</h2>
      <Endpoint method="GET" path={`${list}/{id}`} scope="leads:read" />
      <p>
        <code>200 OK</code> with the <code>Lead</code>, or <code>404</code> <code>not_found</code>.
      </p>

      <h2 id="lead">Lead</h2>
      <p>The same object the <code>lead.created</code> webhook sends as <code>data.lead</code>.</p>
      <FieldTable
        fields={[
          { name: "id", type: "string", text: "A UUID." },
          { name: "status", type: "LeadStatus", text: <a href="#lead-statuses">See below.</a> },
          {
            name: "source",
            type: "string",
            text: "booking_page, website (sent through the API), facebook_lead_form or instagram_lead_form.",
          },
          { name: "service", type: "{ id, name } | null", text: "The service they asked about or were quoted for. id can be null." },
          {
            name: "quote",
            type: "{ totalPence, sizeClass, locationType } | null",
            text: "The last price the booking page showed them, if it got that far.",
          },
          { name: "postcode", type: "string | null", text: "Where the job would be." },
          {
            name: "form",
            type: "{ name, answers } | null",
            text: "The form they filled in and their answers, for enquiries from the API or a lead form. answers is { question, answer }[].",
          },
          { name: "externalId", type: "string | null", text: "The externalId you sent, for enquiries added through the API." },
          { name: "customer", type: "{ id, name, email, phone } | null", text: "Who it's from." },
          { name: "createdAt", type: "string", text: "When it came in." },
          { name: "updatedAt", type: "string", text: "When it last changed." },
        ]}
      />
      <h3 id="lead-statuses">LeadStatus</h3>
      <SimpleTable
        head={["Status", "Meaning"]}
        rows={[
          [<code key="a">new</code>, "They've been in touch, but not had a price."],
          [<code key="b">quoted</code>, "They saw a price on the booking page."],
          [<code key="c">booked</code>, "They went on to book."],
          [<code key="d">lost</code>, "The business marked it as not going ahead."],
        ]}
      />
    </>
  );
}
