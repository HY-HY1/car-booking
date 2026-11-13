import "server-only";
import { createAdminClient } from "../supabase/admin";

// Requests per minute for each API key, counted in the database
// (api_rate_limit_hit, 20261113120000_api_v1.sql) so it holds across server
// instances. If the count can't be made, the request goes through: a broken
// counter mustn't take every business's website down with it.

export const RATE_LIMIT = 120;
export const RATE_WINDOW_SECONDS = 60;

export type RateLimit = { allowed: boolean; limit: number; remaining: number; resetSeconds: number };

export async function hitRateLimit(bucket: string): Promise<RateLimit> {
  const { data, error } = await createAdminClient()
    .rpc("api_rate_limit_hit", { p_bucket: bucket, p_limit: RATE_LIMIT, p_window_seconds: RATE_WINDOW_SECONDS })
    .single<{ allowed: boolean; remaining: number; reset_at: string }>();
  if (error || !data) {
    console.error("[api] rate limit check failed", error);
    return { allowed: true, limit: RATE_LIMIT, remaining: RATE_LIMIT, resetSeconds: RATE_WINDOW_SECONDS };
  }
  return {
    allowed: data.allowed,
    limit: RATE_LIMIT,
    remaining: data.remaining,
    resetSeconds: Math.max(0, Math.ceil((Date.parse(data.reset_at) - Date.now()) / 1000)),
  };
}
