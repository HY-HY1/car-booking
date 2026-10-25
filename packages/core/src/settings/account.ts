import "server-only";
import { createAdminClient } from "../supabase/admin";
import { getStripe } from "../stripe/client";

// Whole-business data export and closing an account (Settings → Privacy).
// Callers check the user is an owner of `tenantId` first.

// Everything the business holds, as one JSON document: its settings, price
// list, customers, enquiries, bookings and the privacy records. Photos are
// listed, not embedded. Secrets (API key hashes, Stripe ids) are left out.
export async function exportBusinessData(tenantId: string) {
  const db = createAdminClient();
  const all = async <T>(q: PromiseLike<{ data: T | null; error: { message: string } | null }>) => {
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data;
  };

  const [business, settings, services, addOns, resources, domains, customers, vehicles, leads, bookings, blocked, photos, consent, requests] =
    await Promise.all([
      all(
        db
          .from("tenants")
          .select("name, slug, trade, branding, contact_email, contact_phone, vat_number, legal_name, privacy_email, ico_registration, retention_months, notification_settings, agent_rules, privacy_policy_url, marketing_consent_text, photo_retention_days, created_at")
          .eq("id", tenantId)
          .single(),
      ),
      all(db.from("booking_settings").select("*").eq("tenant_id", tenantId).maybeSingle()),
      all(db.from("services").select("*").eq("tenant_id", tenantId).order("sort_order")),
      all(db.from("add_ons").select("*").eq("tenant_id", tenantId).order("sort_order")),
      all(db.from("resources").select("*").eq("tenant_id", tenantId).order("sort_order")),
      all(db.from("domains").select("hostname, verified, is_primary, created_at").eq("tenant_id", tenantId)),
      all(db.from("customers").select("*").eq("tenant_id", tenantId).order("created_at")),
      all(db.from("vehicles").select("*").eq("tenant_id", tenantId)),
      all(db.from("leads").select("*").eq("tenant_id", tenantId).order("created_at")),
      all(
        db
          .from("bookings")
          .select("id, customer_id, vehicle_id, service_id, lead_id, resource_id, starts_at, ends_at, status, location_type, address_line, postcode, access_notes, customer_notes, quote_snapshot, price_pence, deposit_pence, deposit_status, decline_reason, source, created_at, updated_at")
          .eq("tenant_id", tenantId)
          .order("starts_at"),
      ),
      all(db.from("blocked_times").select("*").eq("tenant_id", tenantId)),
      all(db.from("photos").select("id, customer_id, lead_id, booking_id, content_type, size_bytes, created_at").eq("tenant_id", tenantId)),
      all(db.from("consent_log").select("customer_id, channel, granted, basis, created_at").eq("tenant_id", tenantId).order("created_at")),
      all(db.from("data_requests").select("*").eq("tenant_id", tenantId).order("received_at")),
    ]);

  return {
    exported_at: new Date().toISOString(),
    business,
    booking_settings: settings,
    services,
    add_ons: addOns,
    vans_and_bays: resources,
    domains,
    customers,
    vehicles,
    enquiries: leads,
    bookings,
    time_off: blocked,
    photos,
    marketing_consent_history: consent,
    data_requests: requests,
  };
}

export const CLOSURE_GRACE_DAYS = 30;

// Sets the subscription to end at the close of the paid period, so nothing
// more is charged, or undoes that. A business not billed through the app has
// no subscription and nothing to change.
async function setCancelAtPeriodEnd(tenantId: string, cancel: boolean) {
  const { data, error } = await createAdminClient()
    .from("tenants")
    .select("stripe_subscription_id, subscription_status")
    .eq("id", tenantId)
    .single();
  if (error) throw error;
  if (!data.stripe_subscription_id || data.subscription_status === "canceled") return;
  await getStripe().subscriptions.update(data.stripe_subscription_id, { cancel_at_period_end: cancel });
}

// "Delete account": marked for deletion, billing stopped. The platform
// deletes it after the grace period; until then the owner can undo it.
export async function requestClosure(tenantId: string, userId: string) {
  await setCancelAtPeriodEnd(tenantId, true);
  const { error } = await createAdminClient()
    .from("tenants")
    .update({ deletion_requested_at: new Date().toISOString(), deletion_requested_by: userId })
    .eq("id", tenantId);
  if (error) throw error;
}

export async function cancelClosure(tenantId: string) {
  await setCancelAtPeriodEnd(tenantId, false);
  const { error } = await createAdminClient()
    .from("tenants")
    .update({ deletion_requested_at: null, deletion_requested_by: null })
    .eq("id", tenantId);
  if (error) throw error;
}

export function closureDate(requestedAt: string) {
  return new Date(new Date(requestedAt).getTime() + CLOSURE_GRACE_DAYS * 86_400_000);
}
