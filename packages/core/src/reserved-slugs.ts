// Business slugs that can't be taken: they'd collide with a subdomain we use
// (www, app, admin, mail…), a fixed page beside /app/<slug> or /admin/<slug>
// (login, signup, account, new), or a name that would confuse customers.
// Checked by slugSchema (platform/rules.ts), which every signup and every
// business the platform creates goes through on the server.

export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  // From the routing spec (info/routing.md)
  "www", "app", "admin", "api", "mail", "email", "smtp", "help", "support", "status", "docs", "blog",
  "book", "booking", "bookings", "dashboard", "login", "signup", "auth", "billing", "static", "assets",
  "cdn", "dev", "staging", "test", "demo",
  // Route names in this codebase
  "account", "new", "onboarding", "platform", "sites",
]);

export function isReservedSlug(slug: string) {
  return RESERVED_SLUGS.has(slug.trim().toLowerCase());
}
