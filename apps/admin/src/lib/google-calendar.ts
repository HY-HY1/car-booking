import "server-only";
import { apiUrl, appUrl } from "@/lib/urls";

// Connecting Google Calendar from Settings → Integrations: the owner's click
// goes to Google's consent screen and comes back to the callback, which has
// to be listed exactly as an "Authorised redirect URI" on the OAuth client.

export const STATE_COOKIE = "gcal_oauth";
export const STATE_PATH = "/api/google/calendar";

// The callback on the dashboard's host, where the session and state cookie are.
export function calendarCallbackUrl() {
  return apiUrl("/google/calendar/callback", { absolute: true });
}

// What Google is told to come back to. Google only accepts plain http on
// exactly "localhost", not app.localhost, so in subdomain mode on this machine
// it comes back to localhost:3000 and the callback passes it on.
export function calendarRedirectUri() {
  const uri = new URL(calendarCallbackUrl());
  if (uri.protocol === "http:" && uri.hostname.endsWith(".localhost")) uri.hostname = "localhost";
  return uri.toString();
}

// Arrived on bare localhost (see above): the same request, on the dashboard's host.
export function forwardedCallback(request: Request) {
  const home = new URL(calendarCallbackUrl());
  const host = request.headers.get("host")?.replace(/:\d+$/, "");
  if (host !== "localhost" || !home.hostname.endsWith(".localhost")) return null;
  return `${home.origin}${home.pathname}${new URL(request.url).search}`;
}

// Where the owner lands afterwards, with how it went.
export function integrationsUrl(slug: string, outcome?: string) {
  const query = outcome ? `?google=${encodeURIComponent(outcome)}` : "";
  return appUrl(`/${slug}/settings/integrations${query}`, { absolute: true });
}
