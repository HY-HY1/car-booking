// Which app answers which request: the one routing table for the project.
// routing/write-vercel-json.mjs writes it into vercel.json (Vercel's config),
// and routing/dev-router.mjs applies it on localhost:3000, so production and
// local development can't drift apart (info/routing.md).
//
// Two Next.js apps share the project, and every request goes to one of them:
//   - the API by path, on any host: the booking app's webhooks and jobs, the admin app's the rest
//   - /booking/… → booking: path mode's booking pages, and old links in
//     subdomain mode (which it redirects to the subdomain)
//   - path mode: everything else → admin (marketing, docs, /app, /admin)
//   - subdomain mode: domain.com, www., app. and admin. → admin; any other
//     host (<slug>.domain.com, a business's own domain) → booking
// Each app then maps the URL onto its own folders in its src/proxy.ts.

/** @typedef {"admin" | "booking"} Service */
/** @typedef {{ source: string, has?: { type: "host", value: string }[], destination: { service: Service } }} Rewrite */

// The booking app's API routes. Everything else under /api is the admin app's.
const BOOKING_API = ["/api/webhooks/stripe", "/api/webhooks/stripe-accounts", "/api/jobs/(.*)"];

/** @param {Record<string, string | undefined>} env */
export function routingMode(env) {
  const mode = env.ROUTING_MODE === "subdomain" ? "subdomain" : "path";
  const browser = env.NEXT_PUBLIC_ROUTING_MODE === "subdomain" ? "subdomain" : "path";
  if (mode !== browser) throw new Error("ROUTING_MODE and NEXT_PUBLIC_ROUTING_MODE must have the same value.");
  if (mode === "subdomain" && !env.NEXT_PUBLIC_ROOT_DOMAIN) {
    throw new Error("Subdomain routing needs NEXT_PUBLIC_ROOT_DOMAIN (the domain the subdomains hang off).");
  }
  return mode;
}

/** @param {Record<string, string | undefined>} env @returns {Rewrite[]} */
export function rewrites(env) {
  /** @param {Service} service */
  const to = (service) => ({ service });
  const shared = [
    ...BOOKING_API.map((source) => ({ source, destination: to("booking") })),
    { source: "/api/(.*)", destination: to("admin") },
    { source: "/booking/(.*)", destination: to("booking") },
  ];
  if (routingMode(env) === "path") return [...shared, { source: "/(.*)", destination: to("admin") }];

  // Exact hostnames, no port: domain.com, www.domain.com, app.domain.com, admin.domain.com.
  const root = (env.NEXT_PUBLIC_ROOT_DOMAIN ?? "").trim().toLowerCase().replace(/:\d+$/, "");
  const adminHosts = [root, `www.${root}`, `app.${root}`, `admin.${root}`];
  return [
    ...shared,
    ...adminHosts.map((value) => ({ source: "/(.*)", has: [{ type: /** @type {const} */ ("host"), value }], destination: to("admin") })),
    { source: "/(.*)", destination: to("booking") },
  ];
}

// The mode a vercel.json was written for: subdomain if any rule matches on host.
/** @param {{ rewrites?: Rewrite[] }} vercelJson */
export function modeOf(vercelJson) {
  return (vercelJson.rewrites ?? []).some((r) => r.has?.length) ? "subdomain" : "path";
}

/** @param {Record<string, string | undefined>} env */
export function vercelConfig(env) {
  return {
    $schema: "https://openapi.vercel.sh/vercel.json",
    services: {
      admin: { root: "apps/admin", framework: "nextjs" },
      booking: { root: "apps/booking", framework: "nextjs" },
    },
    rewrites: rewrites(env),
    // Vercel calls these on the deployment's own URL, which reaches the booking
    // app by the API rules. Hobby plans allow daily jobs only, hence emails at
    // 07:00 (every 15 minutes on Pro).
    crons: [
      { path: "/api/jobs/cleanup-photos", schedule: "0 3 * * *" },
      { path: "/api/jobs/retention", schedule: "0 4 * * 1" },
      { path: "/api/jobs/emails", schedule: "0 7 * * *" },
    ],
  };
}
