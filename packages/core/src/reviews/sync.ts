import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { seal, unseal } from "../calendar/crypto";
import { GoogleError, googleRequest, refreshAccessToken, revokeToken, type Tokens } from "../calendar/google";
import { createAdminClient } from "../supabase/admin";
import { REVIEW_SCOPES, reviewRow, reviewUrlFor, replyProblem, type GoogleReview } from "./rules";

// Google Business Profile reviews (supabase/migrations/20261112120000_integrations.sql).
//
// An owner or manager connects the Google account that manages the
// business's profile and picks the location. Reviews are copied in daily, when
// the Reviews page is opened and the copy is stale, and on "Refresh".
// Replies are written straight to Google.
//
// Google only lets approved projects use the Business Profile APIs: until
// the platform's Google Cloud project has access, every call fails with 403
// and the card says so.

type Db = SupabaseClient;

const ACCOUNTS = "https://mybusinessaccountmanagement.googleapis.com/v1/accounts";
const INFO = "https://mybusinessbusinessinformation.googleapis.com/v1";
const V4 = "https://mybusiness.googleapis.com/v4";

// Reviews are reread when the copy is older than this and someone looks.
export const STALE_MS = 30 * 60_000;
// Newest first, up to this many pages of 50.
const MAX_PAGES = 10;

class NeedsReconnect extends Error {}

const short = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 500);

// What a Google error means to the owner.
function explain(error: unknown) {
  if (error instanceof GoogleError && error.status === 403) {
    return "Google refused: this platform isn't approved for Business Profile access yet, or this account doesn't manage the profile.";
  }
  if (error instanceof GoogleError && error.status === 429) return "Google is limiting requests just now. It'll try again later.";
  return short(error);
}

type ConnectionRow = {
  account_email: string | null;
  refresh_token: string;
  access_token: string | null;
  access_token_expires_at: string | null;
  account_name: string | null;
  location_name: string | null;
  status: string;
};

async function markReconnect(db: Db, tenantId: string, message: string) {
  await db
    .from("google_business_connections")
    .update({ status: "needs_reconnect", last_error: message, access_token: null, access_token_expires_at: null })
    .eq("tenant_id", tenantId);
}

async function connectionOf(db: Db, tenantId: string) {
  const { data, error } = await db
    .from("google_business_connections")
    .select("account_email, refresh_token, access_token, access_token_expires_at, account_name, location_name, status")
    .eq("tenant_id", tenantId)
    .maybeSingle<ConnectionRow>();
  if (error) throw error;
  return data;
}

async function tokenFor(db: Db, tenantId: string, conn: ConnectionRow): Promise<string> {
  const expires = conn.access_token_expires_at ? new Date(conn.access_token_expires_at).getTime() : 0;
  if (conn.access_token && expires > Date.now() + 2 * 60_000) {
    const token = unseal(conn.access_token);
    if (token) return token;
  }
  const refresh = unseal(conn.refresh_token);
  if (!refresh) {
    await markReconnect(db, tenantId, "The saved Google sign-in can't be read any more. Connect again.");
    throw new NeedsReconnect();
  }
  try {
    const fresh = await refreshAccessToken(refresh);
    const { error } = await db
      .from("google_business_connections")
      .update({ access_token: seal(fresh.accessToken), access_token_expires_at: fresh.expiresAt.toISOString() })
      .eq("tenant_id", tenantId);
    if (error) throw error;
    return fresh.accessToken;
  } catch (error) {
    if (error instanceof GoogleError && error.reason === "invalid_grant") {
      await markReconnect(db, tenantId, "Google ended the connection (access removed, password changed, or it expired).");
      throw new NeedsReconnect();
    }
    throw error;
  }
}

// ------------------------------------------------------------------ connecting

export function hasReviewScope(tokens: Tokens) {
  return tokens.scopes.includes(REVIEW_SCOPES[2]);
}

export type LocationOption = { accountName: string; locationName: string; title: string; address: string | null };

type Location = {
  name: string;
  title?: string;
  metadata?: { placeId?: string; newReviewUri?: string };
  storefrontAddress?: { addressLines?: string[]; postalCode?: string };
};

async function locationsOf(token: string): Promise<(LocationOption & { location: Location })[]> {
  const accounts = await googleRequest<{ accounts?: { name: string }[] }>(token, "GET", `${ACCOUNTS}?pageSize=20`);
  const out: (LocationOption & { location: Location })[] = [];
  for (const account of accounts?.accounts ?? []) {
    const q = new URLSearchParams({ readMask: "name,title,metadata,storefrontAddress", pageSize: "100" });
    const res = await googleRequest<{ locations?: Location[] }>(token, "GET", `${INFO}/${account.name}/locations?${q}`);
    for (const l of res?.locations ?? []) {
      const a = l.storefrontAddress;
      out.push({
        accountName: account.name,
        locationName: l.name,
        title: l.title ?? "Unnamed location",
        address: a ? [...(a.addressLines ?? []), a.postalCode].filter(Boolean).join(", ") || null : null,
        location: l,
      });
    }
  }
  return out;
}

// After Google's consent screen. Picks the location by itself when there's
// only one; otherwise the owner chooses on the Integrations page.
export async function saveBusinessConnection(tenantId: string, userId: string, tokens: Tokens) {
  if (!hasReviewScope(tokens)) return { ok: false as const };
  const db = createAdminClient();
  const existing = await connectionOf(db, tenantId);
  const sameAccount = existing && existing.account_email === tokens.email;
  const { error } = await db.from("google_business_connections").upsert(
    {
      tenant_id: tenantId,
      account_email: tokens.email,
      refresh_token: seal(tokens.refreshToken),
      access_token: seal(tokens.accessToken),
      access_token_expires_at: tokens.expiresAt.toISOString(),
      status: "active",
      last_error: null,
      connected_by: userId,
      // A different Google account: its locations are different too.
      ...(!sameAccount && { account_name: null, location_name: null, location_title: null, place_id: null, review_url: null }),
    },
    { onConflict: "tenant_id" },
  );
  if (error) throw error;
  if (!sameAccount) {
    const cleared = await db.from("google_reviews").delete().eq("tenant_id", tenantId);
    if (cleared.error) throw cleared.error;
  }

  if (!sameAccount || !existing?.location_name) {
    try {
      const options = await locationsOf(tokens.accessToken);
      if (options.length === 1) await useLocation(db, tenantId, options[0]);
      else if (!options.length) {
        await db
          .from("google_business_connections")
          .update({ last_error: "This Google account doesn't manage any business profiles." })
          .eq("tenant_id", tenantId);
      }
    } catch (error) {
      await db.from("google_business_connections").update({ last_error: explain(error) }).eq("tenant_id", tenantId);
    }
  }
  return { ok: true as const };
}

async function useLocation(db: Db, tenantId: string, option: LocationOption & { location: Location }) {
  const placeId = option.location.metadata?.placeId ?? null;
  const { error } = await db
    .from("google_business_connections")
    .update({
      account_name: option.accountName,
      location_name: option.locationName,
      location_title: option.title.slice(0, 300),
      place_id: placeId,
      review_url: option.location.metadata?.newReviewUri ?? (placeId ? reviewUrlFor(placeId) : null),
      last_error: null,
    })
    .eq("tenant_id", tenantId);
  if (error) throw error;
}

// The locations to choose from, or null if Google can't be asked just now.
export async function listLocationOptions(tenantId: string): Promise<LocationOption[] | null> {
  const db = createAdminClient();
  const conn = await connectionOf(db, tenantId);
  if (!conn || conn.status !== "active") return null;
  try {
    const options = await locationsOf(await tokenFor(db, tenantId, conn));
    return options.map(({ location: _location, ...o }) => o);
  } catch (error) {
    if (!(error instanceof NeedsReconnect)) {
      console.error("[reviews] listing locations failed", error);
      await db.from("google_business_connections").update({ last_error: explain(error) }).eq("tenant_id", tenantId);
    }
    return null;
  }
}

export async function chooseLocation(tenantId: string, locationName: string) {
  const db = createAdminClient();
  const conn = await connectionOf(db, tenantId);
  if (!conn || conn.status !== "active") return { error: "Connect Google first." };
  const options = await locationsOf(await tokenFor(db, tenantId, conn));
  const picked = options.find((o) => o.locationName === locationName);
  if (!picked) return { error: "That location isn't on this Google account." };
  if (picked.locationName !== conn.location_name) {
    const cleared = await db.from("google_reviews").delete().eq("tenant_id", tenantId);
    if (cleared.error) throw cleared.error;
  }
  await useLocation(db, tenantId, picked);
  return {};
}

export async function disconnectBusiness(tenantId: string) {
  const db = createAdminClient();
  const conn = await connectionOf(db, tenantId);
  if (!conn) return;
  const refresh = unseal(conn.refresh_token);
  if (refresh) await revokeToken(refresh).catch((error) => console.error("[reviews] revoke failed", error));
  const reviews = await db.from("google_reviews").delete().eq("tenant_id", tenantId);
  if (reviews.error) throw reviews.error;
  const { error } = await db.from("google_business_connections").delete().eq("tenant_id", tenantId);
  if (error) throw error;
}

// ------------------------------------------------------------------ syncing

// Rereads the location's reviews. Returns an error for the owner, if any.
export async function syncReviews(tenantId: string): Promise<{ error?: string }> {
  const db = createAdminClient();
  const conn = await connectionOf(db, tenantId);
  if (!conn || conn.status !== "active") return { error: "Google isn't connected." };
  if (!conn.account_name || !conn.location_name) return { error: "Pick which business location to show first." };
  try {
    const token = await tokenFor(db, tenantId, conn);
    const rows: ReturnType<typeof reviewRow>[] = [];
    let average: number | null = null;
    let total: number | null = null;
    let pageToken: string | undefined;
    let complete = false;
    for (let page = 0; page < MAX_PAGES; page++) {
      const q = new URLSearchParams({ pageSize: "50", orderBy: "updateTime desc", ...(pageToken && { pageToken }) });
      const res = await googleRequest<{ reviews?: GoogleReview[]; averageRating?: number; totalReviewCount?: number; nextPageToken?: string }>(
        token,
        "GET",
        `${V4}/${conn.account_name}/${conn.location_name}/reviews?${q}`,
      );
      if (!res) return { error: "Google no longer has that location. Pick it again." };
      rows.push(...(res.reviews ?? []).map(reviewRow));
      average ??= res.averageRating ?? null;
      total ??= res.totalReviewCount ?? null;
      pageToken = res.nextPageToken;
      if (!pageToken) {
        complete = true;
        break;
      }
    }

    const now = new Date().toISOString();
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await db
        .from("google_reviews")
        .upsert(rows.slice(i, i + 200).map((r) => ({ ...r, tenant_id: tenantId, synced_at: now })), { onConflict: "tenant_id,review_name" });
      if (error) throw error;
    }
    // Read them all: anything not seen was deleted on Google.
    if (complete) {
      const { error } = await db.from("google_reviews").delete().eq("tenant_id", tenantId).lt("synced_at", now);
      if (error) throw error;
    }
    const { error } = await db
      .from("google_business_connections")
      .update({
        average_rating: average === null ? null : Math.round(average * 10) / 10,
        total_reviews: total,
        last_synced_at: now,
        last_error: null,
      })
      .eq("tenant_id", tenantId);
    if (error) throw error;
    return {};
  } catch (error) {
    if (error instanceof NeedsReconnect) return { error: "Google ended the connection. Connect again." };
    console.error("[reviews] sync failed", error);
    const message = explain(error);
    await db.from("google_business_connections").update({ last_error: message }).eq("tenant_id", tenantId);
    return { error: message };
  }
}

// Posts (or replaces) the business's public reply.
export async function replyToReview(tenantId: string, reviewId: string, text: string): Promise<{ error?: string }> {
  const problem = replyProblem(text);
  if (problem) return { error: problem };
  const db = createAdminClient();
  const [conn, review] = await Promise.all([
    connectionOf(db, tenantId),
    db.from("google_reviews").select("review_name").eq("tenant_id", tenantId).eq("id", reviewId).maybeSingle(),
  ]);
  if (review.error) throw review.error;
  if (!review.data) return { error: "That review is no longer on Google." };
  if (!conn || conn.status !== "active") return { error: "Google isn't connected." };
  try {
    const token = await tokenFor(db, tenantId, conn);
    const res = await googleRequest<{ comment?: string; updateTime?: string }>(token, "PUT", `${V4}/${review.data.review_name}/reply`, {
      comment: text.trim(),
    });
    if (!res) return { error: "That review is no longer on Google." };
    const { error } = await db
      .from("google_reviews")
      .update({ reply: text.trim(), reply_updated_at: res.updateTime ?? new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("id", reviewId);
    if (error) throw error;
    return {};
  } catch (error) {
    if (error instanceof NeedsReconnect) return { error: "Google ended the connection. Connect again." };
    console.error("[reviews] reply failed", error);
    return { error: explain(error) };
  }
}

export async function deleteReviewReply(tenantId: string, reviewId: string): Promise<{ error?: string }> {
  const db = createAdminClient();
  const [conn, review] = await Promise.all([
    connectionOf(db, tenantId),
    db.from("google_reviews").select("review_name").eq("tenant_id", tenantId).eq("id", reviewId).maybeSingle(),
  ]);
  if (review.error) throw review.error;
  if (!review.data) return {};
  if (!conn || conn.status !== "active") return { error: "Google isn't connected." };
  try {
    await googleRequest(await tokenFor(db, tenantId, conn), "DELETE", `${V4}/${review.data.review_name}/reply`);
    const { error } = await db
      .from("google_reviews")
      .update({ reply: null, reply_updated_at: null })
      .eq("tenant_id", tenantId)
      .eq("id", reviewId);
    if (error) throw error;
    return {};
  } catch (error) {
    if (error instanceof NeedsReconnect) return { error: "Google ended the connection. Connect again." };
    console.error("[reviews] deleting a reply failed", error);
    return { error: explain(error) };
  }
}

// What Settings → Integrations shows.
export async function loadReviewSettings(tenantId: string) {
  const { data, error } = await createAdminClient()
    .from("google_business_connections")
    .select("account_email, location_name, location_title, review_url, average_rating, total_reviews, status, last_error, last_synced_at")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  return data
    ? {
        email: data.account_email as string | null,
        locationChosen: Boolean(data.location_name),
        locationTitle: data.location_title as string | null,
        reviewUrl: data.review_url as string | null,
        averageRating: data.average_rating === null ? null : Number(data.average_rating),
        totalReviews: data.total_reviews as number | null,
        status: data.status as "active" | "needs_reconnect",
        lastError: data.last_error as string | null,
        lastSyncedAt: data.last_synced_at as string | null,
      }
    : null;
}

// Daily: every connected business's reviews.
export async function runReviewJobs() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("google_business_connections")
    .select("tenant_id")
    .eq("status", "active")
    .not("location_name", "is", null);
  if (error) throw error;
  let synced = 0;
  let failed = 0;
  for (const row of data) {
    const result = await syncReviews(row.tenant_id);
    if (result.error) failed++;
    else synced++;
  }
  return { synced, failed };
}
