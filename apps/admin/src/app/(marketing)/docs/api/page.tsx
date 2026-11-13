import type { Metadata } from "next";
import Link from "next/link";
import { DEFAULT_LIMIT, MAX_LIMIT } from "@leadgen/core/api/query";
import { RATE_LIMIT } from "@leadgen/core/api/rate-limit";
import { API_SCOPES, SCOPE_KEYS } from "@leadgen/core/api/scopes";
import { CodeBlock } from "@/components/docs/code-block";
import { Callout, DocTitle, Place, SimpleTable } from "@/components/docs/docs-kit";
import { exampleCursor } from "@/lib/docs-examples";
import { apiUrl, docsUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "API overview" };

// Every endpoint, in the order the reference covers them.
const ENDPOINTS: { method: string; path: string; scope: string; text: string; page: string }[] = [
  { method: "GET", path: "/business", scope: "catalog:read", text: "Name, contact details, branding, opening hours and booking rules.", page: "/api/business" },
  { method: "GET", path: "/catalog", scope: "catalog:read", text: "Active services and extras, with prices and page content.", page: "/api/catalog" },
  { method: "GET", path: "/quote", scope: "catalog:read", text: "The price of a job: service, vehicle size, extras and where.", page: "/api/quote" },
  { method: "GET", path: "/availability/dates", scope: "catalog:read", text: "Dates with at least one free start time for a job.", page: "/api/availability" },
  { method: "GET", path: "/availability/slots", scope: "catalog:read", text: "Free start times on one date.", page: "/api/availability" },
  { method: "GET", path: "/service-area", scope: "catalog:read", text: "Whether the business comes out to a postcode.", page: "/api/service-area" },
  { method: "GET", path: "/bookings", scope: "bookings:read", text: "Bookings, a page at a time, with filters.", page: "/api/bookings" },
  { method: "GET", path: "/bookings/{id}", scope: "bookings:read", text: "One booking.", page: "/api/bookings" },
  { method: "GET", path: "/leads", scope: "leads:read", text: "Enquiries, a page at a time, with filters.", page: "/api/leads" },
  { method: "GET", path: "/leads/{id}", scope: "leads:read", text: "One enquiry.", page: "/api/leads" },
  { method: "POST", path: "/leads", scope: "leads:write", text: "Add an enquiry from a form on your own website.", page: "/api/leads" },
  { method: "GET", path: "/customers", scope: "customers:read", text: "Customers, a page at a time, or found by email or phone.", page: "/api/customers" },
  { method: "GET", path: "/customers/{id}", scope: "customers:read", text: "One customer, with their vehicles.", page: "/api/customers" },
  { method: "GET", path: "/webhooks", scope: "webhooks:write", text: "The business's webhooks.", page: "/api/webhooks#manage" },
  { method: "POST", path: "/webhooks", scope: "webhooks:write", text: "Add a webhook.", page: "/api/webhooks#manage" },
  { method: "GET", path: "/webhooks/{id}", scope: "webhooks:write", text: "One webhook.", page: "/api/webhooks#manage" },
  { method: "DELETE", path: "/webhooks/{id}", scope: "webhooks:write", text: "Remove a webhook.", page: "/api/webhooks#manage" },
];

const ERRORS: [string, string, string][] = [
  ["400", "invalid_request", "A query parameter or body field is missing or wrong. param says which."],
  ["401", "missing_key", "No Authorization header, or it isn't in the form Bearer <key>."],
  ["401", "invalid_key", "The key doesn't exist or has been revoked."],
  ["403", "insufficient_scope", "The key works, but wasn't given the scope this endpoint needs."],
  ["404", "not_found", "No booking, lead, customer or webhook with that id for this business."],
  ["409", "not_set_up", "The business hasn't finished setting up its booking page, so it can't be quoted yet."],
  ["409", "limit_reached", "The business already has as many webhooks as it can."],
  ["422", "unknown_service", "The serviceId isn't one of the business's active services."],
  ["422", "unknown_add_on", "One of the addOnIds isn't an active extra."],
  ["422", "add_on_not_for_service", "One of the extras can't go with that service."],
  ["422", "location_not_offered", "The business doesn't do that service there (mobile or unit)."],
  ["422", "postcode_required", "Mobile availability needs the postcode where the car will be."],
  ["422", "unknown_postcode", "That postcode doesn't exist."],
  ["429", "rate_limited", `More than ${RATE_LIMIT} requests in a minute with this key. Wait for Retry-After seconds.`],
  ["500", "server_error", "Something went wrong on our side. Try again shortly."],
];

export default function ApiOverview() {
  const base = apiUrl("/v1", { absolute: true });

  return (
    <>
      <DocTitle eyebrow="API" title="API overview">
        <p>
          A REST API over HTTPS that returns JSON. A business&apos;s website can show its services, prices, opening
          hours and free times, and its other systems can read bookings, customers and enquiries, send enquiries in,
          and subscribe to webhooks.
        </p>
      </DocTitle>

      <h2 id="base-url">Base URL</h2>
      <CodeBlock title="Base URL" code={base} />
      <p>
        Every path below goes after it, so the catalogue is <code>{base}/catalog</code>. All requests use HTTPS in
        production, and every response is JSON in UTF-8.
      </p>

      <h2 id="endpoints">Endpoints</h2>
      <SimpleTable
        head={["Method and path", "Scope", "Returns"]}
        rows={ENDPOINTS.map((e) => [
          <Link key="p" href={docsUrl(e.page)} className="font-mono text-[13px] whitespace-nowrap">
            {e.method} {e.path}
          </Link>,
          <code key="s">{e.scope}</code>,
          e.text,
        ])}
      />
      <p>
        All the types are in one file on <Link href={docsUrl("/api/types")}>TypeScript types</Link>.
      </p>

      <h2 id="authentication">Authentication</h2>
      <p>
        Every request needs one of the business&apos;s API keys, sent as a bearer token. The key alone decides which
        business&apos;s data you get: nothing in the request can point it at another one.
      </p>
      <CodeBlock title="Terminal" code={`curl ${base}/business \\\n  -H "Authorization: Bearer $BOOKING_API_KEY"`} />
      <p>
        The business owner makes keys under <Place>Settings → Integrations</Place>. See{" "}
        <Link href={docsUrl("/api/keys")}>API keys</Link>.
      </p>

      <h2 id="scopes">Scopes</h2>
      <p>
        Each key can do only what the owner ticked when they made it. A key without the scope an endpoint needs gets a{" "}
        <code>403</code> with the code <code>insufficient_scope</code>. Keys made before scopes existed have{" "}
        <code>catalog:read</code> only.
      </p>
      <SimpleTable
        head={["Scope", "Lets the key", "Customer details?"]}
        rows={SCOPE_KEYS.map((s) => [<code key="s">{s}</code>, API_SCOPES[s].detail, API_SCOPES[s].personal ? "Yes" : "No"])}
      />

      <h2 id="server-only">Call it from a server, not a browser</h2>
      <p>
        Call the API from your website&apos;s server, or when the site builds. Don&apos;t call it from JavaScript that
        runs in visitors&apos; browsers, because anyone could read the key from the page. To stop that happening by
        accident, the API sends no CORS headers, so browsers block cross-site requests to it.
      </p>

      <h2 id="requests">Requests</h2>
      <ul>
        <li>
          <strong>Query parameters</strong> are used on every <code>GET</code>. Lists, such as several statuses, are
          comma-separated: <code>?status=confirmed,completed</code>.
        </li>
        <li>
          <strong>Bodies</strong> on <code>POST</code> are JSON, sent with <code>Content-Type: application/json</code>.
        </li>
        <li>
          <strong>Ids</strong> are UUIDs. A malformed id gets a <code>404</code>, the same as one that doesn&apos;t exist.
        </li>
        <li>
          <strong>Field names</strong> are camelCase in both requests and responses.
        </li>
      </ul>

      <h2 id="money-and-dates">Money and dates</h2>
      <p>
        Prices are in pounds sterling, as whole numbers of pence (<code>8500</code> is £85). Fields ending in{" "}
        <code>Pence</code> are for sums. Where a formatted copy comes too (<code>&quot;£85&quot;</code>), use it for display.
      </p>
      <p>
        Times are ISO 8601 in UTC, such as <code>2026-11-20T09:00:00.000Z</code>. Plain dates (<code>2026-11-20</code>)
        are days in the business&apos;s own time zone, which <Link href={docsUrl("/api/business")}>/business</Link>{" "}
        gives as <code>timezone</code>. Date filters take either a date (meaning midnight there) or a full date and time
        with a time zone.
      </p>

      <h2 id="pagination">Pagination</h2>
      <p>
        Lists come a page at a time, as <code>{"{ data, hasMore, nextCursor }"}</code>. Ask for up to {MAX_LIMIT} at a time
        with <code>limit</code> (the default is {DEFAULT_LIMIT}). When <code>hasMore</code> is true, send{" "}
        <code>nextCursor</code> back as <code>cursor</code>, with the same filters, for the next page.
      </p>
      <CodeBlock
        title="200 OK"
        code={JSON.stringify({ data: ["…"], hasMore: true, nextCursor: exampleCursor }, null, 2)}
      />
      <p>
        Cursors are opaque: don&apos;t build or change them. Pages carry on from the last row you saw, so rows added
        while you page through don&apos;t make you miss or repeat any.
      </p>
      <CodeBlock
        title="TypeScript: every page"
        code={`async function all<T>(path: string): Promise<T[]> {
  const rows: T[] = [];
  let cursor: string | null = null;
  do {
    const url = new URL(\`${base}\${path}\`);
    url.searchParams.set("limit", "${MAX_LIMIT}");
    if (cursor) url.searchParams.set("cursor", cursor);
    const res = await fetch(url, { headers: { Authorization: \`Bearer \${process.env.BOOKING_API_KEY}\` } });
    if (!res.ok) throw new Error(\`API \${res.status}\`);
    const page = await res.json();
    rows.push(...page.data);
    cursor = page.nextCursor;
  } while (cursor);
  return rows;
}`}
      />

      <h2 id="errors">Errors</h2>
      <p>Errors come back with an HTTP status and a body like this:</p>
      <CodeBlock
        title="400 Bad Request"
        code={JSON.stringify(
          { error: { code: "invalid_request", message: "limit must be a whole number from 1 to 100.", param: "limit" } },
          null,
          2,
        )}
      />
      <p>
        <code>param</code> is there when one query parameter or body field caused it. Branch on <code>code</code>, not{" "}
        <code>message</code>: messages are written for people and may be reworded.
      </p>
      <SimpleTable head={["Status", "code", "Meaning"]} rows={ERRORS.map(([s, c, m]) => [s, <code key="c">{c}</code>, m])} />

      <h2 id="rate-limits">Rate limits</h2>
      <p>
        Each key can make {RATE_LIMIT} requests a minute. Every response says where you are:
      </p>
      <SimpleTable
        head={["Header", "Meaning"]}
        rows={[
          [<code key="a">RateLimit-Limit</code>, `Requests allowed a minute: ${RATE_LIMIT}.`],
          [<code key="b">RateLimit-Remaining</code>, "How many are left this minute."],
          [<code key="c">RateLimit-Reset</code>, "Seconds until the count starts again."],
          [<code key="d">Retry-After</code>, "On a 429 only: seconds to wait before trying again."],
        ]}
      />
      <p>
        A site that fetches at build time, or caches for a few minutes, never gets near it. Need more for a good reason?
        Get in touch.
      </p>

      <h2 id="caching">Caching</h2>
      <p>
        <code>/catalog</code> sends an <code>ETag</code>. Send it back as <code>If-None-Match</code> and, if nothing has
        changed, you get <code>304 Not Modified</code> with no body. Everything else is <code>Cache-Control: no-store</code>.
      </p>
      <p>
        Prices don&apos;t change minute to minute, so fetch the catalogue and business details when your site builds, or
        cache them for a few minutes. If the API can&apos;t be reached, keep showing the last copy you had. Free times do
        change, so fetch those when a visitor asks for them.
      </p>

      <h2 id="webhooks">Webhooks</h2>
      <p>
        Rather than asking for new bookings over and over, have them sent to you as they happen. See{" "}
        <Link href={docsUrl("/api/webhooks")}>Webhooks</Link>.
      </p>

      <h2 id="versioning">Versioning</h2>
      <p>
        The version is in the path (<code>/api/v1</code>). The shape of v1 is fixed: new fields may be added, so ignore
        ones you don&apos;t know, but nothing will be removed, renamed or change type. Anything that would will come as{" "}
        <code>/api/v2</code>, and v1 will keep working.
      </p>
      <Callout>
        <p>
          Building a site for a business? They create the key and give it to you. You don&apos;t need an account of
          your own.
        </p>
      </Callout>
    </>
  );
}
