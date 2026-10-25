// Vercel's project configuration. It's code rather than vercel.json so the
// routing can follow the env vars (info/routing.md): it's evaluated when a
// deployment builds, so switching routing mode is an env change and a
// redeploy. routing/dev-router.mjs applies these same rules on localhost:3000.
//
// Two Next.js apps share the project, and every request goes to one of them:
//   - the API by path, on any host: the booking app's webhooks and jobs, the admin app's the rest
//   - /booking/… → booking: path mode's booking pages, and old links in
//     subdomain mode (which it redirects to the subdomain)
//   - path mode: everything else → admin (marketing, docs, /app, /admin)
//   - subdomain mode: domain.com, www., app. and admin. → admin; any other
//     host (<slug>.domain.com, a business's own domain) → booking
// Each app then maps the URL onto its own folders in its src/proxy.ts.

type Env = Record<string, string | undefined>;
type Service = "admin" | "booking";
export type Rewrite = {
  source: string;
  has?: { type: "host"; value: string }[];
  destination: { service: Service };
};

// The booking app's API routes. Everything else under /api is the admin app's.
const BOOKING_API = ["/api/webhooks/stripe", "/api/webhooks/stripe-accounts", "/api/jobs/(.*)"];

export function routingMode(env: Env) {
  const mode = env.ROUTING_MODE === "subdomain" ? "subdomain" : "path";
  const browser = env.NEXT_PUBLIC_ROUTING_MODE === "subdomain" ? "subdomain" : "path";
  if (mode !== browser) throw new Error("ROUTING_MODE and NEXT_PUBLIC_ROUTING_MODE must have the same value.");
  if (mode === "subdomain" && !env.NEXT_PUBLIC_ROOT_DOMAIN) {
    throw new Error("Subdomain routing needs NEXT_PUBLIC_ROOT_DOMAIN (the domain the subdomains hang off).");
  }
  return mode;
}

export function rewrites(env: Env): Rewrite[] {
  const to = (service: Service) => ({ service });
  const shared: Rewrite[] = [
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
    ...adminHosts.map((value) => ({ source: "/(.*)", has: [{ type: "host" as const, value }], destination: to("admin") })),
    { source: "/(.*)", destination: to("booking") },
  ];
}

export const config = {
  services: {
    admin: { root: "apps/admin", framework: "nextjs" },
    booking: { root: "apps/booking", framework: "nextjs" },
  },
  rewrites: rewrites(process.env),
  // Vercel calls these on the deployment's own URL, which reaches the booking app by the API rule above.
  // Hobby plans allow daily jobs only, hence emails at 07:00 (every 15 minutes on Pro).
  crons: [
    { path: "/api/jobs/cleanup-photos", schedule: "0 3 * * *" },
    { path: "/api/jobs/retention", schedule: "0 4 * * 1" },
    { path: "/api/jobs/emails", schedule: "0 7 * * *" },
  ],
};
