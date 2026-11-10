import "server-only";
import { apiUrl, appUrl } from "@/lib/urls";

// Connecting Google (Calendar, Business Profile) and Facebook from Settings →
// Integrations: the owner's click goes to the provider's consent screen and
// comes back to a callback, which has to be listed exactly as an allowed
// redirect address with the provider.

export const STATE_COOKIE = "gcal_oauth";
export const STATE_PATH = "/api/google/calendar";

// The callback on the dashboard's host, where the session and state cookie are.
function callbackUrl(path: string) {
  return apiUrl(path, { absolute: true });
}

// What the provider is told to come back to. Google only accepts plain http
// on exactly "localhost", not app.localhost, so in subdomain mode on this
// machine it comes back to localhost:3000 and the callback passes it on.
export function redirectUriFor(path: string) {
  const uri = new URL(callbackUrl(path));
  if (uri.protocol === "http:" && uri.hostname.endsWith(".localhost")) uri.hostname = "localhost";
  return uri.toString();
}

// Arrived on bare localhost (see above): the same request, on the dashboard's host.
export function forwardedTo(request: Request, path: string) {
  const home = new URL(callbackUrl(path));
  const host = request.headers.get("host")?.replace(/:\d+$/, "");
  if (host !== "localhost" || !home.hostname.endsWith(".localhost")) return null;
  return `${home.origin}${home.pathname}${new URL(request.url).search}`;
}

const CALENDAR_CALLBACK = "/google/calendar/callback";

export function calendarRedirectUri() {
  return redirectUriFor(CALENDAR_CALLBACK);
}

export function forwardedCallback(request: Request) {
  return forwardedTo(request, CALENDAR_CALLBACK);
}

// Where the owner lands afterwards, with how it went: ?google=connected,
// ?reviews=denied, ?meta=failed…
export function integrationsUrl(slug: string, outcome?: string, key: "google" | "reviews" | "meta" = "google") {
  const query = outcome ? `?${key}=${encodeURIComponent(outcome)}` : "";
  return appUrl(`/${slug}/settings/integrations${query}`, { absolute: true });
}
