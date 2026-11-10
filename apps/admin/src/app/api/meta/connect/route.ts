import { NextResponse } from "next/server";
import { metaConfigured, metaDialogUrl } from "@leadgen/core/meta/graph";
import { requireTenant } from "@/lib/auth";
import { integrationsUrl, redirectUriFor } from "@/lib/google-calendar";
import { META_OAUTH, SLUG, startOAuth } from "@/lib/oauth-state";

const { callback: CALLBACK, cookie: COOKIE } = META_OAUTH;

// GET /api/meta/connect?tenant=<slug>: "Connect Facebook". Sends an owner or
// manager to Facebook's login dialog to allow reading their Page's leads.

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("tenant");
  if (!slug || !SLUG.test(slug)) return new Response("Not found", { status: 404 });

  const { can } = await requireTenant(slug);
  if (!can("settings.edit")) return NextResponse.redirect(integrationsUrl(slug, "no_access", "meta"));
  if (!metaConfigured()) return NextResponse.redirect(integrationsUrl(slug, "unconfigured", "meta"));

  const redirectUri = redirectUriFor(CALLBACK);
  return startOAuth((state) => metaDialogUrl({ redirectUri, state }), { ...COOKIE, secure: redirectUri.startsWith("https://") }, slug);
}
