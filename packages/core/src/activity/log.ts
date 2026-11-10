import "server-only";
import { createAdminClient } from "../supabase/admin";
import type { ActivityAction, ActivityEntity } from "./rules";

// Adds a line to the business's activity log. Never throws: by the time this
// runs the change has been made, and a log that can't be written mustn't make
// it look as if the change failed.
export async function recordActivity(entry: {
  tenantId: string;
  actorId: string | null;
  actorEmail: string | null;
  action: ActivityAction;
  summary: string;
  entity?: ActivityEntity;
}) {
  try {
    const { error } = await createAdminClient().from("activity_log").insert({
      tenant_id: entry.tenantId,
      actor_id: entry.actorId,
      actor_email: entry.actorEmail,
      action: entry.action,
      summary: entry.summary,
      entity_type: entry.entity?.type ?? null,
      entity_id: entry.entity?.id ?? null,
    });
    if (error) console.error("Couldn't write to the activity log", error);
  } catch (error) {
    console.error("Couldn't write to the activity log", error);
  }
}
