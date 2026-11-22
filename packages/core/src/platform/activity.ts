import "server-only";
import { ACTIVITY_AREAS, type ActivityArea } from "../activity/rules";
import { createAdminClient } from "../supabase/admin";
import type { ActivityRow } from "./overview";

// Every business's activity log in one list, newest first, for the platform
// admin. Filtered by business and by area. Uses the secret key; the caller
// has checked requirePlatformAdmin().

export const ACTIVITY_PAGE = 50;

export async function listPlatformActivity(opts: { tenantId?: string | null; area?: ActivityArea | null; page?: number }) {
  const db = createAdminClient();
  const page = Math.max(0, opts.page ?? 0);
  let query = db
    .from("activity_log")
    .select("id, tenant_id, actor_email, action, summary, created_at, tenant:tenants(name, slug)")
    .order("created_at", { ascending: false })
    .range(page * ACTIVITY_PAGE, page * ACTIVITY_PAGE + ACTIVITY_PAGE);
  if (opts.tenantId) query = query.eq("tenant_id", opts.tenantId);
  if (opts.area && Object.hasOwn(ACTIVITY_AREAS, opts.area)) query = query.like("action", `${opts.area}.%`);

  const { data, error } = await query;
  if (error) throw error;
  // One more than a page was asked for, to know whether there's another.
  const rows: ActivityRow[] = data.slice(0, ACTIVITY_PAGE).map((a) => {
    const tenant = Array.isArray(a.tenant) ? a.tenant[0] : a.tenant;
    return {
      id: a.id,
      at: a.created_at,
      tenant: tenant ? { name: tenant.name, slug: tenant.slug } : null,
      actorEmail: a.actor_email,
      action: a.action,
      summary: a.summary,
    };
  });
  return { rows, hasMore: data.length > ACTIVITY_PAGE, page };
}
