import { loadBookingConfig } from "@/lib/booking-config";
import { getRequestTenant } from "@/lib/tenant";
import { pageUrl } from "@/lib/urls";

// /sitemap.xml: every page of the business's site worth finding in a search,
// at its one canonical address: the home page (with its FAQs), each
// service's page, the booking form, the enquiry page and the terms and
// privacy notice when they're ours rather than links to the business's own.
// None while the site is hidden from search engines.
export async function GET() {
  const tenant = await getRequestTenant();
  if (!tenant || tenant.branding.seo.hidden) return new Response("Not found", { status: 404 });
  const config = await loadBookingConfig(tenant.id).catch(() => null);

  const paths = [
    "/",
    ...(config?.services ?? []).filter((s) => s.slug).map((s) => `/services/${s.slug}`),
    ...(config?.services.length ? ["/quote"] : []),
    ...(tenant.branding.extras.enquiries.show ? ["/contact"] : []),
    ...(tenant.branding.terms_url ? [] : ["/terms"]),
    ...(tenant.privacy.policyUrl ? [] : ["/privacy"]),
  ];
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...paths.map((p) => `  <url><loc>${escape(pageUrl(tenant, p, { absolute: true }))}</loc></url>`),
    `</urlset>`,
  ].join("\n");
  return new Response(`${xml}\n`, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
