// The only way to build an internal link, redirect or absolute URL in this
// app. Shared with the admin app and the emails: packages/core/src/urls.ts.
import { tenantUrl, type UrlOptions } from "@leadgen/core/urls";

export * from "@leadgen/core/urls";

// One of this business's own pages, on its custom domain if it has one
// (subdomain mode): the link every booking page should use.
export function pageUrl(tenant: { slug: string; customDomain: string | null }, path = "/", opts?: UrlOptions) {
  return tenantUrl(tenant.slug, path, { ...opts, customDomain: tenant.customDomain });
}
