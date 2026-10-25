// Every page of the docs, in reading order: the sidebar and the previous/next
// links at the foot of each page come from this. Client-safe. Hrefs are
// relative to the docs: docsUrl() (lib/urls.ts) turns them into links.

export type DocsPage = { href: string; title: string };
export type DocsSection = { title: string; pages: DocsPage[] };

export const DOCS_NAV: DocsSection[] = [
  {
    title: "Start here",
    pages: [
      { href: "/", title: "Introduction" },
      { href: "/getting-started", title: "Getting started" },
    ],
  },
  {
    title: "How it works",
    pages: [
      { href: "/booking-flow", title: "How customers book" },
      { href: "/pricing", title: "Packages and pricing" },
      { href: "/availability", title: "Hours, vans and travel" },
      { href: "/payments", title: "Deposits and payments" },
      { href: "/dashboard", title: "Your dashboard" },
      { href: "/website", title: "Your website and booking link" },
      { href: "/privacy", title: "Customer data and privacy" },
    ],
  },
  {
    title: "API",
    pages: [
      { href: "/api", title: "Overview" },
      { href: "/api/keys", title: "API keys" },
      { href: "/api/catalog", title: "Get the catalogue" },
      { href: "/api/examples", title: "Examples" },
    ],
  },
];

export const DOCS_PAGES = DOCS_NAV.flatMap((s) => s.pages);

// The page a pathname shows. While rendering, Next can report the internal
// /docs/... path rather than the one in the address bar; both map the same.
export function docsPath(pathname: string) {
  return pathname.replace(/^\/docs(?=\/|$)/, "") || "/";
}
