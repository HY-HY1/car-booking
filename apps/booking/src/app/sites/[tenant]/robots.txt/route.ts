import { getRequestTenant } from "@/lib/tenant";
import { pageUrl } from "@/lib/urls";

// /robots.txt on a business's own domain or subdomain: what search engines
// may read, and where the sitemap is. Pages for one customer (their booking,
// a privacy request, a subscription) are kept out. A site hidden from search
// engines is still readable here, so they can see each page's "noindex" tag,
// which is what actually keeps it out of results; it just lists no sitemap.
export async function GET() {
  const tenant = await getRequestTenant();
  if (!tenant) return new Response("Not found", { status: 404 });
  const private_ = ["/manage/", "/confirmed/", "/subscribe", "/unsubscribe", "/privacy/request", "/embed-test"];
  const lines = ["User-agent: *", ...private_.map((p) => `Disallow: ${new URL(pageUrl(tenant, p, { absolute: true })).pathname}`)];
  if (!tenant.branding.seo.hidden) lines.push("", `Sitemap: ${pageUrl(tenant, "/sitemap.xml", { absolute: true })}`);
  return new Response(`${lines.join("\n")}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
