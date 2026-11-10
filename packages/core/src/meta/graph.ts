import "server-only";
import { createHmac } from "node:crypto";
import { GRAPH_VERSION, META_SCOPES, type FieldData } from "./rules";

// Meta's Graph API, called with fetch. Credentials: META_APP_ID and
// META_APP_SECRET from a Meta app with Facebook Login for Business and the
// Webhooks product (Page → leadgen) pointing at /api/webhooks/meta.

const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
const TIMEOUT_MS = 8_000;

export class MetaError extends Error {
  constructor(
    message: string,
    readonly status: number,
    // Meta's code: 190 means the token is no good any more.
    readonly code: number | null,
  ) {
    super(message);
  }
  get tokenDead() {
    return this.code === 190;
  }
}

export function metaConfigured() {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

function credentials() {
  const id = process.env.META_APP_ID;
  const secret = process.env.META_APP_SECRET;
  if (!id || !secret) throw new Error("META_APP_ID and META_APP_SECRET must be set.");
  return { id, secret };
}

export function metaDialogUrl(opts: { redirectUri: string; state: string }) {
  const q = new URLSearchParams({
    client_id: credentials().id,
    redirect_uri: opts.redirectUri,
    state: opts.state,
    response_type: "code",
    scope: META_SCOPES.join(","),
  });
  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${q}`;
}

async function graph<T>(method: string, path: string, params: Record<string, string>, token?: string): Promise<T> {
  const q = new URLSearchParams(params);
  if (token) {
    q.set("access_token", token);
    // Proves the call comes from the app's server, not just someone with the token.
    q.set("appsecret_proof", createHmac("sha256", credentials().secret).update(token).digest("hex"));
  }
  const res = await fetch(`${GRAPH}${path}?${q}`, { method, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const body = (await res.json().catch(() => null)) as (T & { error?: { message?: string; code?: number } }) | null;
  if (!res.ok || body?.error) {
    throw new MetaError(`${method} ${path.split("?")[0]}: ${body?.error?.message ?? res.statusText}`, res.status, body?.error?.code ?? null);
  }
  return body as T;
}

// The code from the login dialog → a long-lived (about 60 day) user token.
export async function exchangeMetaCode(code: string, redirectUri: string) {
  const { id, secret } = credentials();
  const short = await graph<{ access_token: string }>("GET", "/oauth/access_token", {
    client_id: id,
    client_secret: secret,
    redirect_uri: redirectUri,
    code,
  });
  const long = await graph<{ access_token: string; expires_in?: number }>("GET", "/oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: id,
    client_secret: secret,
    fb_exchange_token: short.access_token,
  });
  const me = await graph<{ name?: string }>("GET", "/me", { fields: "name" }, long.access_token);
  const perms = await graph<{ data: { permission: string; status: string }[] }>("GET", "/me/permissions", {}, long.access_token);
  const granted = new Set(perms.data.filter((p) => p.status === "granted").map((p) => p.permission));
  return {
    token: long.access_token,
    expiresAt: long.expires_in ? new Date(Date.now() + long.expires_in * 1000) : null,
    name: me.name ?? null,
    missing: META_SCOPES.filter((s) => !granted.has(s)),
  };
}

export type MetaPage = { id: string; name: string; accessToken: string };

// Pages this person can manage leads for. A Page token got from a long-lived
// user token doesn't expire.
export async function listPages(userToken: string): Promise<MetaPage[]> {
  const res = await graph<{ data: { id: string; name: string; access_token?: string; tasks?: string[] }[] }>(
    "GET",
    "/me/accounts",
    { fields: "id,name,access_token,tasks", limit: "100" },
    userToken,
  );
  return res.data
    .filter((p) => p.access_token && (!p.tasks || p.tasks.some((t) => t === "MANAGE" || t === "ADVERTISE" || t === "MODERATE")))
    .map((p) => ({ id: p.id, name: p.name, accessToken: p.access_token as string }));
}

// Asks Meta to tell us (the app's webhook) about the Page's new leads.
export async function subscribePage(pageId: string, pageToken: string) {
  await graph("POST", `/${pageId}/subscribed_apps`, { subscribed_fields: "leadgen" }, pageToken);
}

export async function unsubscribePage(pageId: string, pageToken: string) {
  await graph("DELETE", `/${pageId}/subscribed_apps`, {}, pageToken);
}

export type MetaLeadRecord = {
  id: string;
  created_time: string;
  field_data?: FieldData;
  form_id?: string;
  ad_name?: string;
  campaign_name?: string;
  platform?: string;
  is_organic?: boolean;
};

export async function getLead(leadgenId: string, pageToken: string) {
  return graph<MetaLeadRecord>(
    "GET",
    `/${leadgenId}`,
    { fields: "id,created_time,field_data,form_id,ad_name,campaign_name,platform,is_organic" },
    pageToken,
  );
}

export async function getFormName(formId: string, pageToken: string) {
  const res = await graph<{ name?: string }>("GET", `/${formId}`, { fields: "name" }, pageToken).catch(() => null);
  return res?.name ?? null;
}
