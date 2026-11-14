import "server-only";
import { createAdminClient } from "../supabase/admin";

// Requests per minute for each API key, counted in the database
// (api_rate_limit_hit, 20261113120000_api_v1.sql) so it holds across server
// instances. If the count can't be made, the request goes through: a broken
// counter mustn't take every business's website down with it.

export const RATE_LIMIT = 120;
export const RATE_WINDOW_SECONDS = 60;

export type RateLimit = { allowed: boolean; limit: number; remaining: number; resetSeconds: number };

// The API's per-key limit by default; other callers (sign-up, by address)
// pass their own limit and window, in their own bucket names.
export async function hitRateLimit(bucket: string, limit = RATE_LIMIT, windowSeconds = RATE_WINDOW_SECONDS): Promise<RateLimit> {
  const { data, error } = await createAdminClient()
    .rpc("api_rate_limit_hit", { p_bucket: bucket, p_limit: limit, p_window_seconds: windowSeconds })
    .single<{ allowed: boolean; remaining: number; reset_at: string }>();
  if (error || !data) {
    console.error("[rate limit] check failed", error);
    return { allowed: true, limit, remaining: limit, resetSeconds: windowSeconds };
  }
  return {
    allowed: data.allowed,
    limit,
    remaining: data.remaining,
    resetSeconds: Math.max(0, Math.ceil((Date.parse(data.reset_at) - Date.now()) / 1000)),
  };
}
