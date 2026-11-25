// The only way to build an internal link, redirect or absolute URL in this
// app. Shared with the booking app and the emails: packages/core/src/urls.ts.
import { adminUrl, appUrl } from "@leadgen/core/urls";

export * from "@leadgen/core/urls";

// The sign-in page, coming back to `next` afterwards. In subdomain mode the
// super-admin signs in on admin.domain.com (a session belongs to the host that
// made it: see lib/supabase), everyone else on app.domain.com. Path mode has
// one origin, so there it's always /app/login.
export function loginUrl(next?: string) {
  return signInPage("/login", next);
}

// Where someone enters their two-factor code, on the same host as their session.
export function secondFactorUrl(next?: string) {
  return signInPage("/login/verify", next);
}

function signInPage(path: string, next?: string) {
  const admin = adminUrl();
  const app = appUrl();
  // Only when the super-admin has a host of its own (not path mode, nor the
  // site on app.<root>, where both share one host and one sign-in page).
  const ownHost = URL.canParse(admin) && URL.canParse(app) && new URL(admin).origin !== new URL(app).origin;
  const forAdmin = ownHost && !!next && URL.canParse(next) && new URL(next).origin === new URL(admin).origin;
  const page = forAdmin ? adminUrl(path) : appUrl(path);
  return next ? `${page}?next=${encodeURIComponent(next)}` : page;
}
