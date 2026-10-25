import { NextResponse, type NextRequest } from "next/server";
import { withSession } from "@/lib/supabase/proxy";
import { adminUrl, appUrl, loginUrl, routingConfig, surfaceForHost } from "@/lib/urls";

// Maps public URLs onto this app's folders, then keeps the Supabase session
// fresh and sends signed-out visitors to sign in (packages/core/src/urls.ts
// has the whole picture):
//
//   path mode       /, /docs, /legal… → (marketing)   /app/… → app/…   /admin/… → admin/…
//   subdomain mode  domain.com/…       → (marketing)
//                   app.domain.com/…   → /app/…
//                   admin.domain.com/… → /admin/…  (its /login is the shared sign-in page)
//
// The API (/api/…) is never rewritten. Old paths from before /app and /admin
// (/dashboard, /platform, /login, /onboarding, /account) redirect, so
// bookmarks and earlier emails keep working.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const cfg = routingConfig();
  const host = cfg.mode === "subdomain" ? surfaceForHost(request.headers.get("host"), cfg).surface : "marketing";
  // Business subdomains and custom domains belong to the booking app.
  if (host === "tenant" || host === "custom") return new NextResponse(null, { status: 404 });

  let internal = pathname;
  if (!isUnder(pathname, "/api")) {
    if (host === "marketing") {
      const old = legacyUrl(pathname, search);
      if (old) return NextResponse.redirect(new URL(old, request.url), 308);
      // In subdomain mode the dashboard and super-admin have hosts of their own.
      if (cfg.mode === "subdomain" && isUnder(pathname, "/app")) {
        return NextResponse.redirect(appUrl(pathname.slice("/app".length) + search), 308);
      }
      if (cfg.mode === "subdomain" && isUnder(pathname, "/admin")) {
        return NextResponse.redirect(adminUrl(pathname.slice("/admin".length) + search), 308);
      }
    } else if (host === "app") {
      internal = `/app${pathname === "/" ? "" : pathname}`;
    } else if (host === "admin") {
      internal = pathname === "/login" ? "/app/login" : `/admin${pathname === "/" ? "" : pathname}`;
    }
  }

  const respond = (init: { request: NextRequest }) =>
    internal === pathname ? NextResponse.next(init) : NextResponse.rewrite(new URL(internal + search, request.url), init);

  // Where to come back to after signing in: the canonical address of what was
  // asked for (not request.nextUrl.origin, which behind a proxy can be the
  // server's own address rather than the one the visitor used).
  const here =
    cfg.mode === "subdomain" ? (host === "admin" ? adminUrl : appUrl)(pathname + search) : pathname + search;
  const signingIn = internal === "/app/login";
  const isPublic = signingIn || isUnder(internal, "/app/signup");
  const isProtected = (isUnder(internal, "/app") || isUnder(internal, "/admin")) && !isPublic;

  return withSession(request, respond, {
    signIn: isProtected ? loginUrl(here) : undefined,
    home: signingIn ? (host === "admin" ? adminUrl() : appUrl()) : undefined,
  });
}

function isUnder(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(`${base}/`);
}

// Where an address from before the move now lives, if it's one of those.
function legacyUrl(pathname: string, search: string) {
  const moved: [string, (rest: string) => string][] = [
    ["/dashboard", (rest) => appUrl(rest)],
    ["/platform", (rest) => adminUrl(rest)],
    ["/login", () => appUrl("/login")],
    ["/onboarding", (rest) => appUrl(`/signup${rest}`)],
    ["/account", (rest) => appUrl(`/account${rest}`)],
  ];
  for (const [base, to] of moved) {
    if (isUnder(pathname, base)) return to(pathname.slice(base.length)) + search;
  }
  return null;
}

export const config = {
  matcher: [
    // Skip static files, images and the public API (key auth, no session).
    "/((?!_next/static|_next/image|favicon.ico|api/v1/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
