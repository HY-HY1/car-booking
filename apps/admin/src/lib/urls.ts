// The only way to build an internal link, redirect or absolute URL in this
// app. Shared with the booking app and the emails: packages/core/src/urls.ts.
import { adminUrl, appUrl } from "@leadgen/core/urls";

export * from "@leadgen/core/urls";

// The sign-in page, coming back to `next` afterwards. In subdomain mode the
// super-admin signs in on admin.domain.com (a session belongs to the host that
// made it: see lib/supabase), everyone else on app.domain.com. Path mode has
// one origin, so there it's always /app/login.
export function loginUrl(next?: string) {
  const admin = adminUrl();
  const forAdmin = URL.canParse(admin) && !!next && URL.canParse(next) && new URL(next).origin === new URL(admin).origin;
  const page = forAdmin ? adminUrl("/login") : appUrl("/login");
  return next ? `${page}?next=${encodeURIComponent(next)}` : page;
}
