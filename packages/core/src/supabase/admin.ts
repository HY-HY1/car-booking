import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Supabase client with the secret key. It bypasses RLS, so every query made
// with it must filter on a tenant_id the server worked out itself (from the
// hostname or the signed-in session), never one sent by the browser or the
// model. Used by the public booking app, webhooks and scheduled jobs.

let client: SupabaseClient | undefined;

export function createAdminClient() {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set in the root .env.local.",
      );
    }
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
