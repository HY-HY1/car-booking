import { after, NextResponse, type NextRequest } from "next/server";
import { exchangeCode } from "@leadgen/core/calendar/google";
import { saveBusinessConnection, syncReviews } from "@leadgen/core/reviews/sync";
import { logActivity } from "@/lib/activity";
import { requireTenant } from "@/lib/auth";
import { forwardedTo, integrationsUrl, redirectUriFor } from "@/lib/google-calendar";
import { checkOAuth, BUSINESS_OAUTH } from "@/lib/oauth-state";
import { appUrl } from "@/lib/urls";

const { callback: CALLBACK, cookie: COOKIE } = BUSINESS_OAUTH;

// GET /api/google/business/callback: back from Google's consent screen.
export async function GET(request: NextRequest) {
  const forward = forwardedTo(request, CALLBACK);
  if (forward) return NextResponse.redirect(forward);

  const { ok, slug, done } = checkOAuth(request, COOKIE);
  const back = (outcome: string) => done(integrationsUrl(slug as string, outcome, "reviews"));
  if (!ok || !slug) return done(slug ? integrationsUrl(slug, "expired", "reviews") : appUrl("/", { absolute: true }));
  const params = request.nextUrl.searchParams;
  if (params.get("error")) return back("denied");
  const code = params.get("code");
  if (!code) return back("failed");

  const { tenant, user, can } = await requireTenant(slug);
  if (!can("settings.edit")) return back("no_access");

  try {
    const tokens = await exchangeCode(code, redirectUriFor(CALLBACK));
    const saved = await saveBusinessConnection(tenant.id, user.id, tokens);
    if (!saved.ok) return back("scope");
  } catch (error) {
    console.error("Connecting Google Business Profile failed", error);
    return back("failed");
  }
  await logActivity(tenant.id, "settings.reviews_connected", "Connected Google Business Profile");
  after(() => syncReviews(tenant.id));
  return back("connected");
}
