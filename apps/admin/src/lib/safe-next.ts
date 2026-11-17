import { adminUrl, appUrl } from "@/lib/urls";

// Where to go after signing in. Only our own pages, so ?next= can't send
// anyone to another site: a same-site path, or (subdomain mode, where every
// surface has its own host) a full URL on the dashboard's or the super-admin's host.
//
// Everything is parsed the way a browser would before it's compared, since
// browsers drop tabs and line breaks and read "\" as "/": "/\t/evil.com"
// looks like a path but is //evil.com to the browser.
export function safeNext(value: unknown, fallback = appUrl()) {
  if (typeof value !== "string" || !value) return fallback;
  const base = new URL(appUrl("/", { absolute: true }));
  let url: URL;
  try {
    url = new URL(value, base);
  } catch {
    return fallback;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return fallback;
  const ours = [base.origin, ...[adminUrl("/", { absolute: true })].filter((u) => URL.canParse(u)).map((u) => new URL(u).origin)];
  if (!ours.includes(url.origin)) return fallback;
  // A path stays a path (on whatever host this is), cleaned up as the browser
  // would read it; a full URL on one of our hosts stays full.
  return value.trimStart().startsWith("/") && url.origin === base.origin ? `${url.pathname}${url.search}${url.hash}` : url.toString();
}
