import "server-only";
import { recordActivity } from "@leadgen/core/activity/log";
import type { ActivityAction, ActivityEntity } from "@leadgen/core/activity/rules";
import { createAdminClient } from "@leadgen/core/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

// Records who just did something, from the signed-in session. Called by a
// server action once the change has been made. Summaries leave out customers'
// names, so erasing a customer leaves nothing behind here.
export async function logActivity(tenantId: string, action: ActivityAction, summary: string, entity?: ActivityEntity) {
  const user = await getCurrentUser();
  await recordActivity({ tenantId, actorId: user?.id ?? null, actorEmail: user?.email ?? null, action, summary, entity });
}

// A login's email address, to say whose access changed.
export async function loginEmail(userId: string) {
  const { data, error } = await createAdminClient().auth.admin.getUserById(userId);
  if (error) console.error("Couldn't look up a login", error);
  return data?.user?.email ?? "a login";
}
