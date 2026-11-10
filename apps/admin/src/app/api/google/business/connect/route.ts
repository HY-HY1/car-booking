import { NextResponse } from "next/server";
import { consentUrl, googleCalendarConfigured } from "@leadgen/core/calendar/google";
import { REVIEW_SCOPES } from "@leadgen/core/reviews/rules";
import { requireTenant } from "@/lib/auth";
import { integrationsUrl, redirectUriFor } from "@/lib/google-calendar";
import { BUSINESS_OAUTH, SLUG, startOAuth } from "@/lib/oauth-state";

const { callback: CALLBACK, cookie: COOKIE } = BUSINESS_OAUTH;

// GET /api/google/business/connect?tenant=<slug>: "Connect Google Business
// Profile". Same Google OAuth client as Calendar, asking for Business Profile.

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("tenant");
  if (!slug || !SLUG.test(slug)) return new Response("Not found", { status: 404 });

  const { can } = await requireTenant(slug);
  if (!can("settings.edit")) return NextResponse.redirect(integrationsUrl(slug, "no_access", "reviews"));
  if (!googleCalendarConfigured()) return NextResponse.redirect(integrationsUrl(slug, "unconfigured", "reviews"));

  const redirectUri = redirectUriFor(CALLBACK);
  return startOAuth(
    (state) => consentUrl({ redirectUri, state, scopes: REVIEW_SCOPES }),
    { ...COOKIE, secure: redirectUri.startsWith("https://") },
    slug,
  );
}
