import "server-only";
import { createAdminClient } from "../supabase/admin";
import { normaliseCode, promoProblem, type Promo } from "./promo-rules";

// Looks a code up for a business and checks it can still be used. Uses are
// counted from live bookings, so a cancelled booking gives its use back.
export async function findPromo(tenantId: string, rawCode: string): Promise<{ ok: true; promo: Promo } | { ok: false; message: string }> {
  const code = normaliseCode(rawCode);
  const db = createAdminClient();
  const { data, error } = await db
    .from("promo_codes")
    .select("id, code, kind, value, active, expires_at, max_uses")
    .eq("tenant_id", tenantId)
    .eq("code", code)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, message: "We don't recognise that code." };

  let uses = 0;
  if (data.max_uses !== null) {
    const counted = await db
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("promo_code_id", data.id)
      .not("status", "in", "(cancelled,expired)");
    if (counted.error) throw counted.error;
    uses = counted.count ?? 0;
  }
  const problem = promoProblem(data, uses, new Date());
  if (problem) return { ok: false, message: problem };
  return { ok: true, promo: { id: data.id, code: data.code, kind: data.kind, value: data.value } };
}
