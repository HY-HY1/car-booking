import "server-only";
import { createAdminClient } from "../supabase/admin";

// How many bookings the business has marked as done: the jobs completed
// count on its booking page (branding/extras.ts). A booking of two cars
// counts once, so the figure never overstates.
export async function countCompletedJobs(tenantId: string): Promise<number> {
  const { count, error } = await createAdminClient()
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("status", "completed");
  if (error) throw error;
  return count ?? 0;
}
