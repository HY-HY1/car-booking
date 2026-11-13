import "server-only";
import { unsubscribeCustomer } from "@leadgen/core/privacy/data";
import { verifyUnsubscribeToken } from "@leadgen/core/privacy/rules";
import { createAdminClient } from "@leadgen/core/supabase/admin";

// The customer an unsubscribe link is for. The token proves the link came
// from us; the customer must also belong to the business at this address.
export async function unsubscribeClaim(tenantId: string, token: string) {
  const secret = process.env.PRIVACY_TOKEN_SECRET;
  if (!secret || !token) return null;
  const claim = await verifyUnsubscribeToken(secret, token);
  if (!claim) return null;
  const { data, error } = await createAdminClient()
    .from("customers")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", claim.customerId)
    .maybeSingle();
  if (error) throw error;
  return data ? claim : null;
}

// Opts them out. Idempotent, so a second press or a repeated request is harmless.
export async function unsubscribeWithToken(tenantId: string, token: string) {
  const claim = await unsubscribeClaim(tenantId, token);
  if (!claim) return false;
  await unsubscribeCustomer(tenantId, claim.customerId, claim.channel);
  return true;
}
