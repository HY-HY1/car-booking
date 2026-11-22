import "server-only";
import { removeOrphanLogins } from "../platform/businesses";
import { createAdminClient } from "../supabase/admin";
import { ABANDONED_AFTER_DAYS, AWAITING_CHECKOUT, isAbandonedSignup } from "./rules";

// Signups that never added a card. Signing up makes the login and business
// before the card step, so someone who walks away (or a bot, or someone using
// another person's email) leaves both behind, holding the dashboard name and
// the email address. After ABANDONED_AFTER_DAYS they're removed: the business
// with everything under it, and the login too unless it belongs to another
// business or is a platform admin. Anything with a booking is left alone for
// a person to look at. Run weekly by the retention job.

export async function removeAbandonedSignups(now = new Date(), days = ABANDONED_AFTER_DAYS) {
  const db = createAdminClient();
  const cutoff = new Date(now.getTime() - days * 86_400_000).toISOString();
  const { data: tenants, error } = await db
    .from("tenants")
    .select("id, slug, subscription_status, stripe_subscription_id, created_at")
    .eq("subscription_status", AWAITING_CHECKOUT)
    .lt("created_at", cutoff)
    .limit(200);
  if (error) throw error;

  let businesses = 0;
  let logins = 0;
  for (const tenant of tenants ?? []) {
    if (!isAbandonedSignup(tenant, now, days)) continue;
    try {
      const [bookings, members] = await Promise.all([
        db.from("bookings").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
        db.from("tenant_members").select("user_id").eq("tenant_id", tenant.id),
      ]);
      if (bookings.error) throw bookings.error;
      if (members.error) throw members.error;
      if (bookings.count) continue;

      const removed = await db.from("tenants").delete().eq("id", tenant.id).eq("subscription_status", AWAITING_CHECKOUT);
      if (removed.error) throw removed.error;
      businesses++;

      logins += await removeOrphanLogins(db, (members.data ?? []).map((m) => m.user_id as string), `abandoned signup ${tenant.slug}`);
    } catch (failure) {
      // One stuck business mustn't stop the rest.
      console.error(`Couldn't remove abandoned signup ${tenant.slug}`, failure);
    }
  }
  return { abandonedSignupsRemoved: businesses, abandonedLoginsRemoved: logins };
}
