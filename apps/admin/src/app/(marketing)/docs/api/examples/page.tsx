import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/components/docs/code-block";
import { DocTitle } from "@/components/docs/docs-kit";
import { apiUrl, docsUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "API examples" };

export default function ApiExamples() {
  const endpoint = apiUrl("/v1/catalog", { absolute: true });
  const base = apiUrl("/v1", { absolute: true });

  return (
    <>
      <DocTitle eyebrow="API" title="Examples">
        <p>
          Code to copy for common setups. Each one keeps the key on the server and avoids fetching on every page view.
        </p>
      </DocTitle>

      <p>
        Every example reads the key from an environment variable called <code>BOOKING_API_KEY</code>. See{" "}
        <Link href={docsUrl("/api/keys")}>API keys</Link> for how to get one.
      </p>

      <h2>curl</h2>
      <p>
        <code>-i</code> shows the headers, including the <code>ETag</code>:
      </p>
      <CodeBlock title="Terminal" code={`curl -i ${endpoint} \\\n  -H "Authorization: Bearer $BOOKING_API_KEY"`} />
      <p>Send the ETag back, and an unchanged catalogue costs a 304 with no body:</p>
      <CodeBlock
        title="Terminal"
        code={`curl -i ${endpoint} \\
  -H "Authorization: Bearer $BOOKING_API_KEY" \\
  -H 'If-None-Match: "the-etag-you-got"'

# HTTP/1.1 304 Not Modified`}
      />

      <h2>Node.js</h2>
      <p>
        Keeps the last copy in memory, asks only for changes, and carries on with the last good copy if the API
        can&apos;t be reached. Works in Node 18 or later, with no packages.
      </p>
      <CodeBlock
        title="catalog.js"
        code={`const CATALOG_URL = "${endpoint}";
let cached = null; // { etag, data }

export async function getCatalog() {
  const headers = { Authorization: \`Bearer \${process.env.BOOKING_API_KEY}\` };
  if (cached) headers["If-None-Match"] = cached.etag;

  try {
    const res = await fetch(CATALOG_URL, { headers });
    if (res.status === 304) return cached.data;
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(\`Catalogue request failed: \${body?.error?.code ?? res.status}\`);
    }
    cached = { etag: res.headers.get("etag"), data: await res.json() };
    return cached.data;
  } catch (error) {
    if (cached) return cached.data; // keep showing the last good copy
    throw error;
  }
}`}
      />

      <h2>Next.js</h2>
      <p>A server component, so the key never reaches the browser. The page refreshes its prices every 5 minutes.</p>
      <CodeBlock
        title="app/services/page.tsx"
        code={`import type { Catalog } from "@/lib/booking-api";

async function getCatalog(): Promise<Catalog> {
  const res = await fetch("${endpoint}", {
    headers: { Authorization: \`Bearer \${process.env.BOOKING_API_KEY}\` },
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(\`Catalogue request failed: \${res.status}\`);
  return res.json();
}

export default async function ServicesPage() {
  const { services } = await getCatalog();

  return (
    <ul>
      {services.map((s) => (
        <li key={s.id}>
          <h2>{s.name}</h2>
          {s.description && <p>{s.description}</p>}
          <p>From {s.price.from}</p>
          {s.bookUrl && <a href={s.bookUrl}>Book now</a>}
        </li>
      ))}
    </ul>
  );
}`}
      />

      <h2>Astro</h2>
      <p>Fetched when the site builds. Rebuild the site to pick up price changes.</p>
      <CodeBlock
        title="src/pages/services.astro"
        code={`---
const res = await fetch("${endpoint}", {
  headers: { Authorization: \`Bearer \${import.meta.env.BOOKING_API_KEY}\` },
});
if (!res.ok) throw new Error(\`Catalogue request failed: \${res.status}\`);
const { services, addOns } = await res.json();
---
<ul>
  {services.map((s) => (
    <li>
      <a href={s.pageUrl ?? s.bookUrl}>{s.name}</a>: from {s.price.from}
    </li>
  ))}
</ul>`}
      />

      <h2>WordPress</h2>
      <p>
        Put the key in <code>wp-config.php</code>, above the line that says &quot;That&apos;s all, stop editing&quot;:
      </p>
      <CodeBlock title="wp-config.php" code={`define('BOOKING_API_KEY', 'ascnd_your_key_here');`} />
      <p>
        Then add this to your theme&apos;s <code>functions.php</code>, or a small plugin. It caches the catalogue for 5
        minutes, falls back to the last good copy if the API can&apos;t be reached, and adds a{" "}
        <code>[booking_prices]</code> shortcode you can put on any page.
      </p>
      <CodeBlock
        title="functions.php"
        code={`function booking_get_catalog() {
    $catalog = get_transient('booking_catalog');
    if ($catalog !== false) {
        return $catalog;
    }

    $res = wp_remote_get('${endpoint}', [
        'headers' => ['Authorization' => 'Bearer ' . BOOKING_API_KEY],
        'timeout' => 10,
    ]);
    if (is_wp_error($res) || wp_remote_retrieve_response_code($res) !== 200) {
        return get_option('booking_catalog_last_good', null);
    }

    $catalog = json_decode(wp_remote_retrieve_body($res), true);
    set_transient('booking_catalog', $catalog, 5 * MINUTE_IN_SECONDS);
    update_option('booking_catalog_last_good', $catalog, false);
    return $catalog;
}

add_shortcode('booking_prices', function () {
    $catalog = booking_get_catalog();
    if (!$catalog) {
        return '';
    }

    $html = '<ul class="booking-prices">';
    foreach ($catalog['services'] as $s) {
        $html .= sprintf('<li><strong>%s</strong> from %s', esc_html($s['name']), esc_html($s['price']['from']));
        if ($s['bookUrl']) {
            $html .= sprintf(' <a href="%s">Book now</a>', esc_url($s['bookUrl']));
        }
        $html .= '</li>';
    }
    return $html . '</ul>';
});`}
      />

      <h2 id="next-available">Next free time</h2>
      <p>
        A &quot;Next available&quot; line for a service page: the first date with a free time, then the first time on it.
        Fetch it when the page is requested, not at build time, since free times change through the day. Needs a mobile
        postcode, or <code>locationType=unit</code>.
      </p>
      <CodeBlock
        title="next-available.ts"
        code={`import type { AvailableDates, AvailableSlots } from "./booking-api";

const API = "${base}";
const headers = { Authorization: \`Bearer \${process.env.BOOKING_API_KEY}\` };

export async function nextAvailable(serviceId: string, sizeClass = "medium") {
  const job = new URLSearchParams({ serviceId, sizeClass, locationType: "unit" });

  const dates: AvailableDates = await fetch(\`\${API}/availability/dates?\${job}\`, { headers }).then((r) => r.json());
  const first = dates.dates[0];
  if (!first) return null;

  job.set("date", first);
  const day: AvailableSlots = await fetch(\`\${API}/availability/slots?\${job}\`, { headers }).then((r) => r.json());
  return day.slots[0] ?? null; // { startsAt, time }
}`}
      />

      <h2 id="contact-form">Contact form to enquiry</h2>
      <p>
        A Next.js server action that sends a website&apos;s contact form into the business&apos;s dashboard as an
        enquiry. The key needs the <code>leads:write</code> scope. The form&apos;s own id makes a double submit
        harmless. See <Link href={docsUrl("/api/leads#create")}>Add an enquiry</Link>.
      </p>
      <CodeBlock
        title="app/contact/actions.ts"
        code={`"use server";

import type { ApiError, Lead } from "@/lib/booking-api";

export async function sendEnquiry(formData: FormData) {
  const res = await fetch("${base}/leads", {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${process.env.BOOKING_API_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: formData.get("name"),
      email: formData.get("email") || undefined,
      phone: formData.get("phone") || undefined,
      message: formData.get("message") || undefined,
      formName: "Contact page",
      externalId: formData.get("submissionId"), // a hidden field, unique per form load
    }),
  });

  if (!res.ok) {
    const { error }: ApiError = await res.json();
    return { error: error.message }; // e.g. "Send an email or a phone number, or both."
  }
  const lead: Lead = await res.json();
  return { ok: true, id: lead.id };
}`}
      />

      <h2 id="sync">Keep a copy of bookings</h2>
      <p>
        For a spreadsheet, accounts or a CRM: ask for everything changed since the last run, a page at a time. The key
        needs <code>bookings:read</code>. Webhooks are quicker if you can receive them; this works from a scheduled job.
      </p>
      <CodeBlock
        title="sync-bookings.ts"
        code={`import type { Booking, List } from "./booking-api";

export async function bookingsChangedSince(since: string): Promise<Booking[]> {
  const changed: Booking[] = [];
  let cursor: string | null = null;
  do {
    const url = new URL("${base}/bookings");
    url.searchParams.set("updatedSince", since);
    url.searchParams.set("limit", "100");
    if (cursor) url.searchParams.set("cursor", cursor);
    const res = await fetch(url, { headers: { Authorization: \`Bearer \${process.env.BOOKING_API_KEY}\` } });
    if (!res.ok) throw new Error(\`Bookings request failed: \${res.status}\`);
    const page: List<Booking> = await res.json();
    changed.push(...page.data);
    cursor = page.nextCursor;
  } while (cursor);
  return changed; // save each by id; remember when this run started for next time
}`}
      />

      <h2 id="types">TypeScript types</h2>
      <p>
        Every request and response is in one file on <Link href={docsUrl("/api/types")}>TypeScript types</Link>. The
        examples import it as <code>booking-api.ts</code>.
      </p>
    </>
  );
}
