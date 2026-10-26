import { NextResponse, type NextRequest } from "next/server";
import { isReservedSlug } from "@leadgen/core/reserved-slugs";
import { hostnameOf, isPlatformHost, parseBookingPath, routingConfig, surfaceForHost, tenantUrl } from "@leadgen/core/urls";
import { customDomainFor, slugForHost } from "@/lib/domain-cache";
import { TENANT_HEADER } from "@/lib/tenant-header";

// Maps public URLs onto the pages under app/sites/[tenant] (packages/core/src/urls.ts
// has the full picture). Rewrites, never redirects, except to send old or
// duplicate addresses to the one canonical URL:
//
//   path mode       /booking/<slug>/…               → /sites/<slug>/…
//                   booking.theirsite.com/… (verified) → /sites/<slug>/…
//                   /booking/<slug>/…, if it has a verified main custom domain → 301 there
//   subdomain mode  <slug>.domain.com/…              → /sites/<slug>/…
//                   booking.theirsite.com/… (verified) → /sites/<slug>/…
//                   /booking/<slug>/…                → 301 to the subdomain or custom domain
//                   <slug>.domain.com, if it has a verified custom domain → 301 there
//
// /sites/… typed in directly is a 404, and so is anything that isn't a
// business. Only custom domains touch the database, through a short cache.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const cfg = routingConfig();
  if (pathname === "/sites" || pathname.startsWith("/sites/")) return notFound(request);

  const booking = parseBookingPath(pathname);
  if (cfg.mode === "path") {
    const host = request.headers.get("host");
    // A business's own domain (book.theirsite.co.uk): its pages at the root.
    if (!isPlatformHost(host, cfg)) {
      const slug = await slugForHost(hostnameOf(host ?? ""));
      if (!slug) return notFound(request);
      // A path-style link to the same business still lands on the right page.
      return toTenant(request, slug, booking?.slug === slug ? booking.rest : pathname);
    }
    if (!booking || isReservedSlug(booking.slug)) return notFound(request);
    // One address per business: its own domain once it's verified and main.
    const customDomain = await customDomainFor(booking.slug);
    const canonical = tenantUrl(booking.slug, booking.rest + search, { customDomain });
    if (customDomain && canonical.startsWith("https://")) return NextResponse.redirect(canonical, 301);
    return toTenant(request, booking.slug, booking.rest);
  }

  // Path-style links from before the switch keep working.
  if (booking) {
    if (isReservedSlug(booking.slug)) return notFound(request);
    const customDomain = await customDomainFor(booking.slug);
    return NextResponse.redirect(tenantUrl(booking.slug, booking.rest + search, { customDomain }), 301);
  }

  const host = surfaceForHost(request.headers.get("host"), cfg);
  if (host.surface === "tenant") {
    if (isReservedSlug(host.slug)) return notFound(request);
    // One address per business, so search engines don't see the pages twice.
    const customDomain = await customDomainFor(host.slug);
    if (customDomain) return NextResponse.redirect(tenantUrl(host.slug, pathname + search, { customDomain }), 301);
    return toTenant(request, host.slug, pathname);
  }
  if (host.surface === "custom") {
    const slug = await slugForHost(host.hostname);
    return slug ? toTenant(request, slug, pathname) : notFound(request);
  }
  // domain.com, app. and admin. belong to the admin app.
  return notFound(request);
}

function toTenant(request: NextRequest, slug: string, rest: string) {
  const headers = new Headers(request.headers);
  headers.set(TENANT_HEADER, slug);
  const url = request.nextUrl.clone();
  url.pathname = `/sites/${slug}${rest === "/" ? "" : rest}`;
  return NextResponse.rewrite(url, { request: { headers } });
}

// Rewritten to a path no page answers, so Next renders app/not-found.tsx with
// a 404. The tenant header is dropped, so nothing renders as a business.
function notFound(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.delete(TENANT_HEADER);
  const url = request.nextUrl.clone();
  url.pathname = "/__not-found";
  url.search = "";
  return NextResponse.rewrite(url, { request: { headers } });
}

export const config = {
  matcher: [
    // Everything but the API (webhooks, jobs) and Next's own files, served
    // under /booking/_next (assetPrefix in next.config.ts). This app has no
    // public/ files, so every page request comes through here.
    "/((?!api/|_next/|booking/_next/).*)",
  ],
};
