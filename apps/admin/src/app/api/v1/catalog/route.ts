import { createHash } from "node:crypto";
import { buildCatalog } from "@leadgen/core/api/catalog";
import { keyFromAuthHeader } from "@leadgen/core/api/key-format";
import { tenantForApiKey } from "@leadgen/core/api/keys";
import { getBookingConfig } from "@leadgen/core/booking/engine";
import { createAdminClient } from "@leadgen/core/supabase/admin";
import { getCustomDomain } from "@leadgen/core/tenants";
import { tenantUrl } from "@/lib/urls";

// GET /api/v1/catalog with "Authorization: Bearer ascnd_…": the business's
// active services, add-ons and page content, for its own website to show.
// The key alone decides which business; there's nothing in the request that
// can point it at another one. Meant to be called from a server or a site
// build, never from browser code (that would show the key to visitors), so
// there are no CORS headers. Responses carry an ETag: send it back as
// If-None-Match and an unchanged catalogue costs a 304 with no body.

function error(status: number, code: string, message: string) {
  return Response.json(
    { error: { code, message } },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...(status === 401 && { "WWW-Authenticate": 'Bearer realm="catalog"' }),
      },
    },
  );
}

const imageUrl = (path: string) =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/service-images/${path}`;

export async function GET(request: Request) {
  const key = keyFromAuthHeader(request.headers.get("authorization"));
  if (!key) return error(401, "missing_key", "Send your API key as: Authorization: Bearer <key>.");

  try {
    const tenantId = await tenantForApiKey(key);
    if (!tenantId) return error(401, "invalid_key", "That API key isn't valid, or has been revoked.");

    const [tenant, config, customDomain] = await Promise.all([
      createAdminClient().from("tenants").select("name, slug").eq("id", tenantId).single(),
      getBookingConfig(tenantId),
      getCustomDomain({ id: tenantId }),
    ]);
    if (tenant.error) throw tenant.error;

    const catalog = buildCatalog({
      businessName: tenant.data.name,
      bookingUrl: tenantUrl(tenant.data.slug, "/", { absolute: true, customDomain }),
      imageUrl,
      services: config?.services ?? [],
      addOns: config?.addOns ?? [],
    });

    const body = JSON.stringify(catalog);
    const etag = `"${createHash("sha256").update(body).digest("base64url").slice(0, 27)}"`;
    const headers = { "Cache-Control": "private, no-cache", ETag: etag };
    if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
    return new Response(body, { headers: { ...headers, "Content-Type": "application/json; charset=utf-8" } });
  } catch (e) {
    console.error("Catalog API failed", e);
    return error(500, "server_error", "Something went wrong. Try again shortly.");
  }
}
