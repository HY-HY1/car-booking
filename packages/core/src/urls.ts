// Every internal link, redirect and absolute URL (emails, Stripe, Supabase)
// is built here, so the URL shape is decided in one place and switching
// between the two routing modes is an env change, not a code change:
//
//   path mode (now)            subdomain mode (with a real domain)
//   /                          https://domain.com             marketing, docs
//   /app/...                   https://app.domain.com/...     business dashboard
//   /admin/...                 https://admin.domain.com/...   super-admin
//   /booking/<slug>/...        https://<slug>.domain.com/...  a business's booking pages,
//                              or its verified custom domain
//
// Path mode keeps every surface on one origin and returns site-relative
// paths unless `absolute` is asked for. Subdomain mode always returns full
// URLs, because each surface lives on its own host. Reads only NEXT_PUBLIC_
// variables, so the browser and the server build the same URLs. Pure.

export type RoutingMode = "path" | "subdomain";

export type RoutingConfig = {
  mode: RoutingMode;
  // domain.com, or localhost:3000 in development. May carry a port.
  rootDomain: string;
  // The marketing site's full URL: https://domain.com, http://localhost:3000.
  siteUrl: string;
};

export function routingConfig(): RoutingConfig {
  return {
    mode: process.env.NEXT_PUBLIC_ROUTING_MODE === "subdomain" ? "subdomain" : "path",
    rootDomain: (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000").trim().toLowerCase().replace(/\/+$/, ""),
    siteUrl: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").trim().replace(/\/+$/, ""),
  };
}

export type UrlOptions = { absolute?: boolean };

// Splits "quote/?embed=1" into "/quote" and "?embed=1", tidying slashes:
// "quote/" → "/quote", "//evil.com" → "/evil.com" (never a protocol-relative
// URL). The root is "", so a prefix such as /app can stand on its own.
function splitPath(path = "/") {
  const cut = path.search(/[?#]/);
  const pathname = cut === -1 ? path : path.slice(0, cut);
  const tail = cut === -1 ? "" : path.slice(cut);
  const clean = `/${pathname.replace(/^\/+/, "")}`.replace(/\/{2,}/g, "/").replace(/\/+$/, "");
  return { pathname: clean, tail };
}

// origin + prefix + path + query. The root has no trailing slash
// ("/app", "https://app.domain.com"), but a bare query keeps one where
// there's no prefix to hang it on ("/?x=1", "https://domain.com/?x=1").
function join(origin: string, prefix: string, path: string) {
  const { pathname, tail } = splitPath(path);
  let local = prefix + pathname;
  if (!local && (tail || !origin)) local = "/";
  return origin + local + tail;
}

function protocolOf(cfg: RoutingConfig) {
  return cfg.siteUrl.startsWith("http://") ? "http:" : "https:";
}

// The port, if the root domain has one (localhost:3000 → ":3000").
function portOf(cfg: RoutingConfig) {
  const match = cfg.rootDomain.match(/:\d+$/);
  return match ? match[0] : "";
}

export function hostnameOf(host: string) {
  return host.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
}

function subdomainOrigin(cfg: RoutingConfig, sub: string) {
  return `${protocolOf(cfg)}//${sub}.${cfg.rootDomain}`;
}

// In path mode everything is on the site's own origin: relative unless asked.
function onSite(cfg: RoutingConfig, prefix: string, path: string, opts?: UrlOptions) {
  return join(opts?.absolute ? cfg.siteUrl : "", prefix, path);
}

export function marketingUrl(path = "/", opts?: UrlOptions) {
  const cfg = routingConfig();
  if (cfg.mode === "subdomain") return join(cfg.siteUrl, "", path);
  return onSite(cfg, "", path, opts);
}

export function appUrl(path = "/", opts?: UrlOptions) {
  const cfg = routingConfig();
  if (cfg.mode === "subdomain") return join(subdomainOrigin(cfg, "app"), "", path);
  return onSite(cfg, "/app", path, opts);
}

export function adminUrl(path = "/", opts?: UrlOptions) {
  const cfg = routingConfig();
  if (cfg.mode === "subdomain") return join(subdomainOrigin(cfg, "admin"), "", path);
  return onSite(cfg, "/admin", path, opts);
}

// Whether the site itself runs on this machine (localhost, *.localhost).
function siteIsLocal(cfg: RoutingConfig) {
  const host = hostnameOf(new URL(cfg.siteUrl).host);
  return host === "localhost" || host.endsWith(".localhost") || host === "127.0.0.1";
}

// A business's booking pages. A verified custom domain (booking.theirsite.com)
// wins in either mode, except while the site runs locally: development keeps
// every link on localhost rather than sending you to the live domain.
export function tenantUrl(
  slug: string,
  path = "/",
  opts?: UrlOptions & { customDomain?: string | null },
) {
  const cfg = routingConfig();
  const custom = opts?.customDomain ? hostnameOf(opts.customDomain) : null;
  // A *.localhost custom domain is a development stand-in: same scheme and port as the site.
  const localCustom = custom === "localhost" || !!custom?.endsWith(".localhost");
  if (custom && localCustom) return join(`${protocolOf(cfg)}//${custom}${portOf(cfg)}`, "", path);
  if (custom && !siteIsLocal(cfg)) return join(`https://${custom}`, "", path);
  if (cfg.mode === "subdomain") return join(subdomainOrigin(cfg, slug), "", path);
  return onSite(cfg, `/booking/${encodeURIComponent(slug)}`, path, opts);
}

// In path mode, whether a request's host is the platform's own address (the
// site, a Vercel preview of it, or this machine) rather than a business's
// own domain, which shows that business's booking pages at its root.
export function isPlatformHost(host: string | null | undefined, cfg = routingConfig()) {
  const h = hostnameOf(host ?? "");
  return (
    h === hostnameOf(new URL(cfg.siteUrl).host) ||
    h.endsWith(".vercel.app") ||
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h === "127.0.0.1"
  );
}

// A page of the docs, which live on the marketing site:
// docsUrl("/api/keys") → /docs/api/keys (path mode), https://domain.com/docs/api/keys.
export function docsUrl(path = "/", opts?: UrlOptions) {
  const { pathname, tail } = splitPath(path);
  return marketingUrl(`/docs${pathname}${tail}`, opts);
}

// The admin app's API (/api/…), which isn't under /app. In subdomain mode it
// is called on the dashboard's host, so routes that need the signed-in
// session (the Stripe onboarding link) get its cookie; any host serves it.
export function apiUrl(path: string, opts?: UrlOptions) {
  const cfg = routingConfig();
  if (cfg.mode === "subdomain") return join(subdomainOrigin(cfg, "app"), "/api", path);
  return onSite(cfg, "/api", path, opts);
}

// A dashboard path as the app sees it, in whichever form it arrives: the
// internal /app/ascnd/bookings (what Next can report while rendering) or the
// address bar's /ascnd/bookings on app.domain.com. For "is this tab active".
export function appPathOf(pathname: string) {
  return pathname.replace(/^\/app(?=\/|$)/, "") || "/";
}

// ---------------------------------------------------------------- reading incoming requests

// Which surface a request is for, from its Host header, in subdomain mode:
// domain.com and www → marketing, app. and admin. → those surfaces, one
// more label → that business's booking pages, anything else → a custom
// domain to look up. Ports are ignored, so *.localhost:3000 works locally.
export type HostSurface =
  | { surface: "marketing" | "app" | "admin" }
  | { surface: "tenant"; slug: string }
  | { surface: "custom"; hostname: string };

export function surfaceForHost(host: string | null | undefined, cfg = routingConfig()): HostSurface {
  const hostname = hostnameOf(host ?? "");
  const root = hostnameOf(cfg.rootDomain);
  if (hostname === root || hostname === `www.${root}`) return { surface: "marketing" };
  if (hostname === `app.${root}`) return { surface: "app" };
  if (hostname === `admin.${root}`) return { surface: "admin" };
  if (hostname.endsWith(`.${root}`)) {
    const sub = hostname.slice(0, -root.length - 1);
    if (!sub.includes(".")) return { surface: "tenant", slug: sub };
  }
  return { surface: "custom", hostname };
}

// "/booking/ascnd/quote" → { slug: "ascnd", rest: "/quote" }. Null for any
// other path, or a slug that can't be one (so "/booking/_next/…" is never a business).
export function parseBookingPath(pathname: string) {
  const match = pathname.match(/^\/booking\/([a-z0-9]+(?:-[a-z0-9]+)*)(\/.*)?$/);
  return match ? { slug: match[1], rest: match[2] ?? "/" } : null;
}
