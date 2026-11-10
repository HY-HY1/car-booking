import { NextResponse, type NextRequest } from "next/server";
import { exchangeMetaCode } from "@leadgen/core/meta/graph";
import { saveMetaConnection } from "@leadgen/core/meta/leads";
import { logActivity } from "@/lib/activity";
import { requireTenant } from "@/lib/auth";
import { forwardedTo, integrationsUrl, redirectUriFor } from "@/lib/google-calendar";
import { checkOAuth, META_OAUTH } from "@/lib/oauth-state";
import { appUrl } from "@/lib/urls";

const { callback: CALLBACK, cookie: COOKIE } = META_OAUTH;

// GET /api/meta/callback: back from Facebook's login dialog.
export async function GET(request: NextRequest) {
  const forward = forwardedTo(request, CALLBACK);
  if (forward) return NextResponse.redirect(forward);

  const { ok, slug, done } = checkOAuth(request, COOKIE);
  const back = (outcome: string) => done(integrationsUrl(slug as string, outcome, "meta"));
  if (!ok || !slug) return done(slug ? integrationsUrl(slug, "expired", "meta") : appUrl("/", { absolute: true }));
  const params = request.nextUrl.searchParams;
  if (params.get("error")) return back("denied");
  const code = params.get("code");
  if (!code) return back("failed");

  const { tenant, user, can } = await requireTenant(slug);
  if (!can("settings.edit")) return back("no_access");

  try {
    const login = await exchangeMetaCode(code, redirectUriFor(CALLBACK));
    if (login.missing.length) return back("scope");
    const saved = await saveMetaConnection(tenant.id, user.id, login);
    await logActivity(tenant.id, "settings.meta_connected", "Connected Facebook lead forms");
    if (saved.error) return back("page_failed");
    return back(saved.needsPage ? "choose_page" : "connected");
  } catch (error) {
    console.error("Connecting Facebook failed", error);
    return back("failed");
  }
}
