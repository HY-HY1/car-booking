import Link from "next/link";
import { ArrowRight, BookOpen, Code } from "lucide-react";
import { CodeBlock } from "@/components/docs/code-block";
import { DocTitle } from "@/components/docs/docs-kit";
import { DOCS_NAV } from "@/lib/docs-nav";
import { apiUrl, docsUrl } from "@/lib/urls";

const blurbs: Record<string, string> = {
  "/getting-started": "Sign up, finish the setup checklist and take your first booking.",
  "/booking-flow": "What your customers see, from picking a service to paying the deposit.",
  "/pricing": "Packages, vehicle sizes, condition levels, extras and deposits.",
  "/availability": "Working hours, vans and bays, travel time and your coverage area.",
  "/payments": "Connecting Stripe, deposits, refunds and payment links.",
  "/dashboard": "The calendar, bookings, leads, customers and team roles.",
  "/website": "The Instant quote button for your site and your booking link.",
  "/privacy": "Data requests, erasing and exporting customer data, retention.",
  "/api": "Base URL, authentication, errors, caching and versioning.",
  "/api/keys": "Create, store and revoke the keys your website uses.",
  "/api/catalog": "Every field in the catalogue response.",
  "/api/examples": "Copy-paste code for curl, Node, Next.js, Astro and WordPress.",
};

function CardList({ section }: { section: string }) {
  const pages = DOCS_NAV.find((s) => s.title === section)?.pages ?? [];
  return (
    <ul className="mt-4 grid list-none gap-3 pl-0 sm:grid-cols-2">
      {pages.map((p) => (
        <li key={p.href} className="mt-0">
          <Link
            href={docsUrl(p.href)}
            className="group flex h-full flex-col rounded-lg border p-4 no-underline transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <span className="flex items-center justify-between font-medium">
              {p.title}
              <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
            <span className="mt-1 text-sm text-muted-foreground">{blurbs[p.href]}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function DocsHome() {
  const endpoint = apiUrl("/v1/catalog", { absolute: true });

  return (
    <>
      <DocTitle title="ASCND documentation">
        <p>
          ASCND gives a detailing business its own booking page with instant quotes, a diary that plans around travel,
          and deposits paid straight to you. These docs explain how it all works, and how to use your data on your own
          website through the API.
        </p>
      </DocTitle>

      <p>
        New here? Start with <Link href={docsUrl("/getting-started")}>Getting started</Link>. It takes you from signing up to your
        first booking.
      </p>

      <h2 className="flex items-center gap-2">
        <BookOpen className="size-5 text-muted-foreground" aria-hidden /> How it works
      </h2>
      <p>For business owners and their team.</p>
      <CardList section="How it works" />

      <h2 className="flex items-center gap-2">
        <Code className="size-5 text-muted-foreground" aria-hidden /> API
      </h2>
      <p>
        For whoever builds your website. The API returns your services, prices, add-ons and service page content, so
        your site always matches your booking page.
      </p>
      <CardList section="API" />

      <h3>Quick start</h3>
      <p>
        Create a key under <strong>Settings → API</strong> in your dashboard, then:
      </p>
      <CodeBlock title="Terminal" code={`curl ${endpoint} \\\n  -H "Authorization: Bearer YOUR_API_KEY"`} />
    </>
  );
}
