import { createHash } from "node:crypto";
import { buildCatalog } from "@leadgen/core/api/catalog";
import { tenantBasics } from "@leadgen/core/api/data";
import { getBookingConfig } from "@leadgen/core/booking/engine";
import { apiRoute } from "@/lib/api";

// GET /api/v1/catalog: the business's active services, add-ons and page
// content, for its own website to show. Responses carry an ETag: send it back
// as If-None-Match and an unchanged catalogue costs a 304 with no body.
// Docs: (marketing)/docs/api/catalog.

const imageUrl = (path: string) =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/service-images/${path}`;

export const GET = apiRoute("catalog:read", async ({ request, key }) => {
  const [tenant, config] = await Promise.all([tenantBasics(key.tenantId), getBookingConfig(key.tenantId)]);
  const catalog = buildCatalog({
    businessName: tenant.name,
    bookingUrl: tenant.url("/"),
    imageUrl,
    services: config?.services ?? [],
    addOns: config?.addOns ?? [],
  });

  const body = JSON.stringify(catalog);
  const etag = `"${createHash("sha256").update(body).digest("base64url").slice(0, 27)}"`;
  const headers = { "Cache-Control": "private, no-cache", ETag: etag };
  const sent = request.headers.get("if-none-match") ?? "";
  // Any of a list, and weak (W/"…") forms, count as a match.
  if (sent.split(",").some((tag) => tag.trim().replace(/^W\//, "") === etag)) return new Response(null, { status: 304, headers });
  return new Response(body, { headers: { ...headers, "Content-Type": "application/json; charset=utf-8" } });
});
