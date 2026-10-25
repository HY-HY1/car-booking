import { cache } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTenantBySlug } from "@leadgen/core/tenants";
import { TENANT_HEADER } from "./tenant-header";

// The tenant for this request. The proxy (src/proxy.ts) works it out from
// the URL, /booking/<slug>/… or the hostname, and passes the slug on in a
// header it sets itself after dropping any the visitor sent. Pages, server
// actions and route handlers all go through here, so the business a visitor
// sees and the data they can touch always come from that one decision.
export const getRequestTenant = cache(async () => {
  const slug = (await headers()).get(TENANT_HEADER);
  return slug ? getTenantBySlug(slug) : null;
});

export async function requireRequestTenant() {
  const tenant = await getRequestTenant();
  if (!tenant) notFound();
  return tenant;
}
