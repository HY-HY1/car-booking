import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase auth session on each request and writes any
// updated auth cookies to both the request and the response.
//
// Auth cookies never get a Domain, so each belongs to the exact host that set
// it. In subdomain mode a session made on app.domain.com is never sent to
// <slug>.domain.com or a business's own domain, which only ever show booking
// pages and don't need it. (Path mode is one origin, and the booking app
// never reads the session either.)
//
// `respond` builds the response to send: NextResponse.next, or a rewrite onto
// this app's folders. A signed-out visitor is sent to `signIn` if it's set;
// a signed-in one to `home` if that's set (for the sign-in page itself).
export async function withSession(
  request: NextRequest,
  respond: (init: { request: NextRequest }) => NextResponse,
  rules: { signIn?: string; home?: string } = {},
) {
  let response = respond({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = respond({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, { ...options, domain: undefined }),
          );
        },
      },
    },
  );

  // Don't run code between createServerClient and getClaims():
  // it can cause users to be logged out at random.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);

  if (!signedIn && rules.signIn) return redirectWithCookies(new URL(rules.signIn, request.url), response);
  if (signedIn && rules.home) return redirectWithCookies(new URL(rules.home, request.url), response);
  return response;
}

// Keeps any refreshed auth cookies when redirecting.
function redirectWithCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
