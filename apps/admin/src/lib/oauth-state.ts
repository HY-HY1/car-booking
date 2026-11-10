import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

// The one-use state for a "Connect" button: set in a cookie when the owner is
// sent to the provider, checked when they come back. The cookie also says
// which business it was for.

export function startOAuth(dialogUrl: (state: string) => string, cookie: { name: string; path: string; secure: boolean }, slug: string) {
  const state = randomBytes(24).toString("hex");
  const response = NextResponse.redirect(dialogUrl(state));
  response.cookies.set(cookie.name, `${state}.${slug}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookie.secure,
    path: cookie.path,
    maxAge: 15 * 60,
  });
  return response;
}

// The business it was started for, if the state matches; and a way to
// finish that clears the cookie.
export function checkOAuth(request: NextRequest, cookie: { name: string; path: string }) {
  const [expected, slug] = (request.cookies.get(cookie.name)?.value ?? "").split(".");
  const state = request.nextUrl.searchParams.get("state") ?? "";
  const ok = Boolean(expected && slug && state.length === expected.length && timingSafeEqual(Buffer.from(state), Buffer.from(expected)));
  const done = (url: string) => {
    const response = NextResponse.redirect(url);
    response.cookies.set(cookie.name, "", { path: cookie.path, maxAge: 0 });
    return response;
  };
  return { ok, slug: slug || null, done };
}

export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Each connection's callback (under /api) and state cookie.
export const BUSINESS_OAUTH = { callback: "/google/business/callback", cookie: { name: "gbp_oauth", path: "/api/google/business" } };
export const META_OAUTH = { callback: "/meta/callback", cookie: { name: "meta_oauth", path: "/api/meta" } };
