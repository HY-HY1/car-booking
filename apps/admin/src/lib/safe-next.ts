import { adminUrl, appUrl } from "@/lib/urls";

// Where to go after signing in. Only our own pages, so ?next= can't send
// anyone to another site: a same-site path, or (subdomain mode, where every
// surface has its own host) a full URL on the dashboard's or the super-admin's host.
export function safeNext(value: unknown, fallback = appUrl()) {
  if (typeof value !== "string" || !value) return fallback;
  if (value.startsWith("/")) {
    return value.startsWith("//") || value.startsWith("/\\") ? fallback : value;
  }
  if (!URL.canParse(value)) return fallback;
  const ours = [appUrl(), adminUrl()].filter((u) => URL.canParse(u)).map((u) => new URL(u).origin);
  return ours.includes(new URL(value).origin) ? value : fallback;
}
