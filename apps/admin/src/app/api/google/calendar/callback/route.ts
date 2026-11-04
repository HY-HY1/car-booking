import { timingSafeEqual } from "node:crypto";
import { after, NextResponse, type NextRequest } from "next/server";
import { exchangeCode } from "@leadgen/core/calendar/google";
import { reconcileCalendar, saveCalendarConnection } from "@leadgen/core/calendar/sync";
import { requireTenant } from "@/lib/auth";
import {
  calendarRedirectUri,
  forwardedCallback,
  integrationsUrl,
  STATE_COOKIE,
  STATE_PATH,
} from "@/lib/google-calendar";
import { appUrl } from "@/lib/urls";

// GET /api/google/calendar/callback: Google's consent screen comes back here.
// The state has to match the cookie set by /connect, and the signed-in
// person has to be able to change the business's settings. Then the first
// sync (every upcoming job in, every calendar read) runs after the redirect.
export async function GET(request: NextRequest) {
  const forward = forwardedCallback(request);
  if (forward) return NextResponse.redirect(forward);

  const params = request.nextUrl.searchParams;
  const [expected, slug] = (request.cookies.get(STATE_COOKIE)?.value ?? "").split(".");
  const state = params.get("state") ?? "";

  const done = (url: string) => {
    const response = NextResponse.redirect(url);
    response.cookies.set(STATE_COOKIE, "", { path: STATE_PATH, maxAge: 0 });
    return response;
  };

  if (!expected || !slug || state.length !== expected.length || !timingSafeEqual(Buffer.from(state), Buffer.from(expected))) {
    // Stale, reused, or not started here: back to the dashboard to try again.
    return done(slug ? integrationsUrl(slug, "expired") : appUrl("/", { absolute: true }));
  }
  if (params.get("error")) return done(integrationsUrl(slug, "denied"));
  const code = params.get("code");
  if (!code) return done(integrationsUrl(slug, "failed"));

  const { tenant, user, can } = await requireTenant(slug);
  if (!can("settings.edit")) return done(integrationsUrl(slug, "no_access"));

  try {
    const tokens = await exchangeCode(code, calendarRedirectUri());
    const saved = await saveCalendarConnection(tenant.id, user.id, tokens);
    if (!saved.ok) return done(integrationsUrl(slug, "scope"));
  } catch (error) {
    console.error("Connecting Google Calendar failed", error);
    return done(integrationsUrl(slug, "failed"));
  }

  after(() => reconcileCalendar(tenant.id));
  return done(integrationsUrl(slug, "connected"));
}
