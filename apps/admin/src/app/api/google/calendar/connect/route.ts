import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { consentUrl, googleCalendarConfigured } from "@leadgen/core/calendar/google";
import { requireTenant } from "@/lib/auth";
import { calendarRedirectUri, integrationsUrl, STATE_COOKIE, STATE_PATH } from "@/lib/google-calendar";

// GET /api/google/calendar/connect?tenant=<slug>: the "Connect Google
// Calendar" button. Sends an owner or manager to Google's consent screen,
// with a one-use state in a cookie that the callback checks.
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("tenant");
  if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return new Response("Not found", { status: 404 });

  const { can } = await requireTenant(slug);
  if (!can("settings.edit")) return NextResponse.redirect(integrationsUrl(slug, "no_access"));
  if (!googleCalendarConfigured()) return NextResponse.redirect(integrationsUrl(slug, "unconfigured"));

  const state = randomBytes(24).toString("hex");
  const redirectUri = calendarRedirectUri();
  const response = NextResponse.redirect(consentUrl({ redirectUri, state }));
  response.cookies.set(STATE_COOKIE, `${state}.${slug}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: redirectUri.startsWith("https://"),
    path: STATE_PATH,
    maxAge: 15 * 60,
  });
  return response;
}
