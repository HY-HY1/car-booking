import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Each service's before and after pairs (before-after.ts), by id. Read apart
// from the rest of a service so that until migration 20261125120000 adds the
// column, the booking pages and the pricing editor still load, just without
// them.
export async function beforeAfterOf(db: SupabaseClient, tenantId: string): Promise<Map<string, unknown>> {
  const { data, error } = await db.from("services").select("id, before_after").eq("tenant_id", tenantId);
  if (error) {
    // 42703: the column isn't there yet.
    if (error.code !== "42703") console.error("Couldn't load the before and after photos", error);
    return new Map();
  }
  return new Map((data as { id: string; before_after: unknown }[]).map((r) => [r.id, r.before_after]));
}
