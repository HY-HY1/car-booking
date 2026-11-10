import "server-only";
import { GOOGLE_SCOPES, type EventBody, type GoogleEvent } from "./event";

// Google's OAuth and Calendar REST APIs, called with fetch: the official
// client library is far bigger than the handful of calls needed here.
// Credentials: GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET, a "Web
// application" OAuth client in Google Cloud with the Calendar API enabled.

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const API = "https://www.googleapis.com/calendar/v3";

const TIMEOUT_MS = 8_000;

export class GoogleError extends Error {
  constructor(
    message: string,
    readonly status: number,
    // Google's own code, e.g. "invalid_grant" when access has been removed.
    readonly reason: string | null = null,
  ) {
    super(message);
  }
}

export function googleCalendarConfigured() {
  return Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
}

function credentials() {
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!id || !secret) throw new Error("GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET must be set.");
  return { id, secret };
}

// Google's consent screen. Offline access with a fresh consent every time,
// so Google always hands back a refresh token, even to an account that
// connected before.
// `scopes`: Calendar's, unless another connection (Business Profile) asks for its own.
export function consentUrl(opts: { redirectUri: string; state: string; loginHint?: string | null; scopes?: readonly string[] }) {
  const params = new URLSearchParams({
    client_id: credentials().id,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: (opts.scopes ?? GOOGLE_SCOPES).join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: opts.state,
  });
  if (opts.loginHint) params.set("login_hint", opts.loginHint);
  return `${AUTH_URL}?${params}`;
}

async function failure(res: Response, what: string) {
  const body = (await res.json().catch(() => null)) as {
    error?: string | { message?: string; errors?: { reason?: string }[] };
    error_description?: string;
  } | null;
  const err = body?.error;
  const reason = typeof err === "string" ? err : (err?.errors?.[0]?.reason ?? null);
  const message = typeof err === "string" ? (body?.error_description ?? err) : (err?.message ?? res.statusText);
  return new GoogleError(`${what}: ${message}`, res.status, reason);
}

async function tokenRequest(params: Record<string, string>, what: string) {
  const { id, secret } = credentials();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, ...params }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw await failure(res, what);
  return (await res.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    scope?: string;
    id_token?: string;
  };
}

export type Tokens = { accessToken: string; expiresAt: Date; refreshToken: string; email: string | null; scopes: string[] };

// The id token comes straight from Google's token endpoint over TLS, so its
// claims can be read without checking the signature (OpenID Connect 3.1.3.7).
function emailOf(idToken: string | undefined) {
  const payload = idToken?.split(".")[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { email?: unknown };
    return typeof claims.email === "string" ? claims.email : null;
  } catch {
    return null;
  }
}

export async function exchangeCode(code: string, redirectUri: string): Promise<Tokens> {
  const t = await tokenRequest({ code, redirect_uri: redirectUri, grant_type: "authorization_code" }, "Code exchange");
  if (!t.refresh_token) throw new GoogleError("Google didn't return a refresh token", 400, "no_refresh_token");
  return {
    accessToken: t.access_token,
    expiresAt: new Date(Date.now() + t.expires_in * 1000),
    refreshToken: t.refresh_token,
    email: emailOf(t.id_token),
    scopes: (t.scope ?? "").split(" ").filter(Boolean),
  };
}

export async function refreshAccessToken(refreshToken: string) {
  const t = await tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" }, "Token refresh");
  return { accessToken: t.access_token, expiresAt: new Date(Date.now() + t.expires_in * 1000) };
}

// Removes our access from the Google account. A token that's already dead is fine.
export async function revokeToken(token: string) {
  const res = await fetch(`${REVOKE_URL}?${new URLSearchParams({ token })}`, {
    method: "POST",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok && res.status !== 400) throw await failure(res, "Revoke");
}

async function call<T>(accessToken: string, method: string, path: string, body?: unknown): Promise<T | null> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, ...(body !== undefined && { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 404 || res.status === 410) return null;
  if (!res.ok) throw await failure(res, `${method} ${path.split("?")[0]}`);
  if (res.status === 204) return {} as T;
  return (await res.json()) as T;
}

// Any other Google API, by full address. Null for 404/410.
export async function googleRequest<T>(accessToken: string, method: string, url: string, body?: unknown): Promise<T | null> {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, ...(body !== undefined && { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 404 || res.status === 410) return null;
  if (!res.ok) throw await failure(res, `${method} ${new URL(url).pathname}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

const cal = (calendarId: string) => `/calendars/${encodeURIComponent(calendarId)}`;

export type GoogleCalendar = { id: string; name: string; primary: boolean };

// Calendars this account can add events to.
export async function listCalendars(accessToken: string): Promise<GoogleCalendar[]> {
  const out: GoogleCalendar[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 5; page++) {
    const q = new URLSearchParams({ minAccessRole: "writer", maxResults: "250", ...(pageToken && { pageToken }) });
    const res = await call<{
      items?: { id: string; summary?: string; summaryOverride?: string; primary?: boolean }[];
      nextPageToken?: string;
    }>(accessToken, "GET", `/users/me/calendarList?${q}`);
    for (const c of res?.items ?? []) {
      out.push({ id: c.id, name: c.summaryOverride || c.summary || c.id, primary: c.primary === true });
    }
    pageToken = res?.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

// Writes the event with this id, bringing it back if it was deleted in
// Google. Returns the id it ended up with, or null if the calendar is gone.
export async function upsertEvent(accessToken: string, calendarId: string, eventId: string, body: EventBody) {
  const q = "?sendUpdates=none";
  const updated = await call<{ id: string }>(accessToken, "PUT", `${cal(calendarId)}/events/${encodeURIComponent(eventId)}${q}`, body);
  if (updated) return updated.id;
  try {
    const created = await call<{ id: string }>(accessToken, "POST", `${cal(calendarId)}/events${q}`, { id: eventId, ...body });
    return created?.id ?? null;
  } catch (error) {
    // 409: the id is taken where we can't see it (another calendar's copy).
    // Let Google pick a fresh one.
    if (!(error instanceof GoogleError) || error.status !== 409) throw error;
    const created = await call<{ id: string }>(accessToken, "POST", `${cal(calendarId)}/events${q}`, body);
    return created?.id ?? null;
  }
}

export async function deleteEvent(accessToken: string, calendarId: string, eventId: string) {
  await call(accessToken, "DELETE", `${cal(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`);
}

// Every event overlapping a stretch of time, repeats expanded, deleted ones
// included (so a job deleted in Google is noticed). Null if the calendar has
// gone or this account can no longer see it.
export async function listEvents(accessToken: string, calendarId: string, from: Date, to: Date) {
  const items: GoogleEvent[] = [];
  let timeZone: string | null = null;
  let pageToken: string | undefined;
  for (let page = 0; page < 10; page++) {
    const q = new URLSearchParams({
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      singleEvents: "true",
      showDeleted: "true",
      maxResults: "2500",
      fields:
        "timeZone,nextPageToken,items(id,status,start,end,transparency,eventType,attendees(self,responseStatus),extendedProperties/private)",
      ...(pageToken && { pageToken }),
    });
    const res = await call<{ items?: GoogleEvent[]; timeZone?: string; nextPageToken?: string }>(
      accessToken,
      "GET",
      `${cal(calendarId)}/events?${q}`,
    );
    if (!res) return null;
    items.push(...(res.items ?? []));
    timeZone ??= res.timeZone ?? null;
    pageToken = res.nextPageToken;
    if (!pageToken) break;
  }
  return { items, timeZone };
}

// Asks Google to call `address` whenever the calendar's events change.
export async function watchEvents(
  accessToken: string,
  calendarId: string,
  channel: { id: string; token: string; address: string; expiresAt: Date },
) {
  const res = await call<{ resourceId: string; expiration?: string }>(accessToken, "POST", `${cal(calendarId)}/events/watch`, {
    id: channel.id,
    type: "web_hook",
    address: channel.address,
    token: channel.token,
    expiration: String(channel.expiresAt.getTime()),
  });
  if (!res) return null;
  return {
    resourceId: res.resourceId,
    expiresAt: res.expiration ? new Date(Number(res.expiration)) : channel.expiresAt,
  };
}

export async function stopChannel(accessToken: string, channel: { id: string; resourceId: string }) {
  await call(accessToken, "POST", "/channels/stop", channel);
}
