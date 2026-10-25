import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/components/docs/code-block";
import { DocTitle } from "@/components/docs/docs-kit";
import { apiUrl, docsUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "API examples" };

// The v1 response shape, for TypeScript sites. v1 never changes shape (see the
// overview's versioning section), so this can't drift from catalog.ts.
const TYPES = `export type Catalog = {
  version: 1;
  business: { name: string; bookingUrl: string | null };
  services: CatalogService[];
  addOns: CatalogAddOn[];
};

export type CatalogService = {
  id: string;
  slug: string | null;
  name: string;
  tagline: string | null;
  description: string | null;
  badge: string | null;
  durationMins: number;
  locations: ("mobile" | "unit")[];
  price: {
    fromPence: number;
    from: string;
    bySize: {
      size: "small" | "medium" | "large" | "xl";
      label: string;
      extraPence: number;
      extraMins: number;
    }[];
  };
  image: string | null;
  gallery: string[];
  includes: string[];
  notIncluded: string[];
  steps: { title: string; text: string }[];
  faqs: { q: string; a: string }[];
  body: string | null;
  seo: { title: string | null; description: string | null };
  pageUrl: string | null;
  bookUrl: string | null;
};

export type CatalogAddOn = {
  id: string;
  name: string;
  description: string | null;
  pricePence: number;
  price: string;
  durationMins: number;
  serviceIds: string[] | null;
};`;

export default function ApiExamples() {
  const endpoint = apiUrl("/v1/catalog", { absolute: true });

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
        code={`import type { Catalog } from "@/lib/catalog-types";

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

      <h2 id="types">TypeScript types</h2>
      <p>The full v1 response, ready to drop into a TypeScript project:</p>
      <CodeBlock title="catalog-types.ts" code={TYPES} />
    </>
  );
}
