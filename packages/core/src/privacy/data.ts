import "server-only";
import { PHOTO_BUCKET } from "../photos";
import { createAdminClient } from "../supabase/admin";
import type { MarketingChannel, PublicRequest } from "./rules";

// Server-side UK GDPR operations. All use the secret key, so each takes a
// tenantId the caller worked out itself (hostname or signed-in session) and
// filters on it.

export type EraseResult = "deleted" | "anonymised" | "not_found";

// Removes a customer's photo files, then erases their details: deleted if
// they never booked, anonymised (bookings kept, person removed) if they did.
export async function eraseCustomer(tenantId: string, customerId: string): Promise<EraseResult> {
  const db = createAdminClient();

  const photos = await db
    .from("photos")
    .select("storage_path")
    .eq("tenant_id", tenantId)
    .eq("customer_id", customerId);
  if (photos.error) throw photos.error;
  if (photos.data.length) {
    const removed = await db.storage.from(PHOTO_BUCKET).remove(photos.data.map((p) => p.storage_path));
    if (removed.error) throw removed.error;
  }

  const { data, error } = await db.rpc("anonymise_customer", { p_tenant: tenantId, p_customer: customerId });
  if (error) throw error;
  return data as EraseResult;
}

// Everything held about one customer, as a plain object for a subject access
// request. Photos are listed by name and date; the files themselves aren't
// embedded.
export async function exportCustomerData(tenantId: string, customerId: string) {
  const db = createAdminClient();
  const one = async <T>(q: PromiseLike<{ data: T | null; error: { message: string } | null }>) => {
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data;
  };

  const customer = await one(
    db.from("customers").select("*").eq("tenant_id", tenantId).eq("id", customerId).maybeSingle(),
  );
  if (!customer) return null;

  const [vehicles, leads, bookings, photos, consent, requests] = await Promise.all([
    one(db.from("vehicles").select("*").eq("tenant_id", tenantId).eq("customer_id", customerId)),
    one(db.from("leads").select("*").eq("tenant_id", tenantId).eq("customer_id", customerId)),
    one(db.from("bookings").select("*").eq("tenant_id", tenantId).eq("customer_id", customerId)),
    one(
      db.from("photos").select("id, content_type, size_bytes, created_at, booking_id")
        .eq("tenant_id", tenantId).eq("customer_id", customerId),
    ),
    one(
      db.from("consent_log").select("channel, granted, basis, created_at")
        .eq("tenant_id", tenantId).eq("customer_id", customerId).order("created_at"),
    ),
    one(
      db.from("data_requests").select("kind, status, received_at, due_at, closed_at")
        .eq("tenant_id", tenantId).eq("customer_id", customerId),
    ),
  ]);

  return {
    exported_at: new Date().toISOString(),
    customer,
    vehicles,
    enquiries: leads,
    bookings,
    photos,
    marketing_consent_history: consent,
    data_requests: requests,
  };
}

// A request sent from the public privacy page. Matched to a customer record
// by email if there is one, but nothing is released or erased until the owner
// has checked who is asking.
export async function logPublicRequest(tenantId: string, request: PublicRequest) {
  const db = createAdminClient();
  const match = await db
    .from("customers")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("email", request.email)
    .maybeSingle();
  if (match.error) throw match.error;

  const { error } = await db.from("data_requests").insert({
    tenant_id: tenantId,
    customer_id: match.data?.id ?? null,
    kind: request.kind,
    requester_name: request.name,
    requester_email: request.email,
    details: request.details || null,
    source: "website",
  });
  if (error) throw error;
}

// One-click opt-out from a marketing message.
export async function unsubscribeCustomer(tenantId: string, customerId: string, channel: MarketingChannel) {
  const db = createAdminClient();
  const { error } = await db
    .from("customers")
    .update({ [`${channel}_marketing`]: false, marketing_updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", customerId);
  if (error) throw error;
}

// Erases every customer past their business's retention period. Run weekly.
export async function runRetention(limit = 200) {
  const db = createAdminClient();
  const { data, error } = await db.rpc("find_stale_customers", { p_limit: limit });
  if (error) throw error;

  let erased = 0;
  for (const row of data as { tenant_id: string; customer_id: string }[]) {
    try {
      await eraseCustomer(row.tenant_id, row.customer_id);
      erased++;
    } catch (e) {
      console.error("Retention erase failed", row.customer_id, e);
    }
  }
  return { found: (data as unknown[]).length, erased };
}
