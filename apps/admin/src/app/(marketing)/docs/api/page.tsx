import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/components/docs/code-block";
import { Callout, DocTitle, SimpleTable } from "@/components/docs/docs-kit";
import { apiUrl, docsUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "API overview" };

export default function ApiOverview() {
  const base = apiUrl("/v1", { absolute: true });

  return (
    <>
      <DocTitle eyebrow="API" title="API overview">
        <p>
          A read-only API that gives a business&apos;s own website its services, prices, extras and service page
          content, so the site always matches the booking page.
        </p>
      </DocTitle>

      <p>
        Typical uses: a pricing table on the business&apos;s homepage, a page per service built from the same
        content as its booking page, or &quot;Book now&quot; buttons that go straight to the right service.
      </p>

      <h2>Base URL</h2>
      <CodeBlock title="Base URL" code={base} />
      <p>All requests use HTTPS in production. Every endpoint returns JSON in UTF-8.</p>

      <h2>Endpoints</h2>
      <SimpleTable
        head={["Method and path", "Returns"]}
        rows={[
          [
            <Link key="catalog" href={docsUrl("/api/catalog")} className="font-mono text-[13px]">
              GET /catalog
            </Link>,
            "The business's active services and extras, with prices and page content.",
          ],
        ]}
      />

      <h2>Authentication</h2>
      <p>
        Every request needs one of the business&apos;s API keys, sent as a bearer token. The key alone decides which
        business&apos;s data comes back, and a key can only ever read its own business.
      </p>
      <CodeBlock title="Header" code="Authorization: Bearer ascnd_YOUR_KEY" />
      <p>
        Keys are created by the business owner under <strong>Settings → API</strong>. See{" "}
        <Link href={docsUrl("/api/keys")}>API keys</Link>.
      </p>

      <h2 id="server-only">Call it from a server, not a browser</h2>
      <p>
        Fetch from your website&apos;s server, or when the site builds. Don&apos;t call it from JavaScript that runs in
        visitors&apos; browsers: anyone could read the key from the page. To stop that happening by accident, the API
        sends no CORS headers, so browsers block cross-site requests to it.
      </p>

      <h2>What&apos;s in it, and what isn&apos;t</h2>
      <p>
        The API returns product data only: what the business sells and for how much. It never returns customers,
        bookings, leads, payments or anything else personal, and it can&apos;t change anything.
      </p>

      <h2>Money</h2>
      <p>
        Prices are in pounds sterling. Each one comes twice: as a whole number of pence for sums (
        <code>8500</code>), and formatted for display (<code>&quot;£85&quot;</code>, <code>&quot;£15.50&quot;</code>).
        Use the pence for maths and the formatted string for showing.
      </p>

      <h2 id="errors">Errors</h2>
      <p>Errors come back with an HTTP status and a body like this:</p>
      <CodeBlock
        title="401 Unauthorized"
        code={JSON.stringify(
          { error: { code: "invalid_key", message: "That API key isn't valid, or has been revoked." } },
          null,
          2,
        )}
      />
      <SimpleTable
        head={["Status", "code", "Meaning"]}
        rows={[
          ["401", <code key="m">missing_key</code>, "No Authorization header, or it isn't in the form Bearer <key>."],
          ["401", <code key="i">invalid_key</code>, "The key doesn't exist or has been revoked."],
          ["500", <code key="s">server_error</code>, "Something went wrong on our side. Try again shortly."],
        ]}
      />
      <p>
        Branch on <code>code</code>, not <code>message</code>: messages are written for people and may be reworded.
      </p>

      <h2 id="caching">Caching</h2>
      <p>
        Every successful response has an <code>ETag</code> header. Send it back in <code>If-None-Match</code> next time,
        and if nothing has changed you get <code>304 Not Modified</code> with no body. That makes frequent checks cheap.
      </p>
      <p>
        Prices don&apos;t change minute to minute, so fetch when your site builds, or cache the response for a few
        minutes. There&apos;s no need to call the API on every page view. If the API can&apos;t be reached, keep showing
        the last copy you had.
      </p>
      <p>
        See <Link href={docsUrl("/api/examples")}>Examples</Link> for code that does this.
      </p>

      <h2 id="versioning">Versioning</h2>
      <p>
        The version is in the path (<code>/api/v1</code>) and in every response body (<code>&quot;version&quot;: 1</code>
        ). The shape of v1 responses is fixed. Anything that would remove, rename or change the type of a field will
        come as <code>/api/v2</code>, and v1 will keep working.
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
