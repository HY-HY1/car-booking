import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "../supabase/admin";
import { generateApiKey, hashApiKey } from "./key-format";

// Creating, listing, revoking and checking a business's API keys. Callers
// check the user is the business's owner first; these use the secret key.

const HOUR_MS = 60 * 60 * 1000;

export type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

// Takes the caller's client: the dashboard lists keys through the signed-in
// owner's session, so RLS checks it too and no secret-key client is made
// while a page renders.
export async function listApiKeys(db: SupabaseClient, tenantId: string): Promise<ApiKeyRow[]> {
  const { data, error } = await db
    .from("api_keys")
    .select("id, name, prefix, created_at, last_used_at, revoked_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

// Returns the key itself. It isn't stored, so this is the only time it exists.
export async function createApiKey(tenantId: string, name: string, createdBy: string) {
  const { key, hash, prefix } = generateApiKey();
  const { error } = await createAdminClient()
    .from("api_keys")
    .insert({ tenant_id: tenantId, name, prefix, key_hash: hash, created_by: createdBy });
  if (error) throw error;
  return key;
}

export async function revokeApiKey(tenantId: string, id: string) {
  const { error } = await createAdminClient()
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .is("revoked_at", null);
  if (error) throw error;
}

// The business a key belongs to, or null for an unknown or revoked key. Notes
// when it was last used, at most once an hour so polling doesn't mean a
// write on every request.
export async function tenantForApiKey(key: string): Promise<string | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("api_keys")
    .select("id, tenant_id, last_used_at")
    .eq("key_hash", hashApiKey(key))
    .is("revoked_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  if (!data.last_used_at || Date.now() - Date.parse(data.last_used_at) > HOUR_MS) {
    const { error: touchError } = await db
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", data.id);
    if (touchError) console.error("Couldn't record API key use", touchError);
  }
  return data.tenant_id;
}
