import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/components/docs/code-block";
import { DocTitle } from "@/components/docs/docs-kit";
import { API_TYPES_SOURCE } from "@/lib/api-types-source";
import { docsUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "TypeScript types" };

export default function ApiTypes() {
  return (
    <>
      <DocTitle eyebrow="API" title="TypeScript types">
        <p>Every request and response in one file, to copy into your project.</p>
      </DocTitle>
      <p>
        This is the file the API&apos;s own code is checked against, shown as it is, so it&apos;s always exactly what the
        API sends. It has no imports. Save it as <code>booking-api.ts</code> and import what you need:
      </p>
      <CodeBlock
        title="Using it"
        code={`import type { Booking, List } from "./booking-api";

const res = await fetch("https://…/api/v1/bookings?from=2026-11-20", {
  headers: { Authorization: \`Bearer \${process.env.BOOKING_API_KEY}\` },
});
const page: List<Booking> = await res.json();`}
      />
      <p>
        Comments in the file explain each field. Each page of the reference covers its own part in more detail, starting
        with the <Link href={docsUrl("/api")}>overview</Link>.
      </p>
      <h2>booking-api.ts</h2>
      <CodeBlock title="booking-api.ts" code={API_TYPES_SOURCE} />
    </>
  );
}
