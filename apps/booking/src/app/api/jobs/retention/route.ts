import { refuseUnlessCron } from "@leadgen/core/cron-auth";
import { pruneRateLimits } from "@leadgen/core/api/rate-limit";
import { removeAbandonedSignups } from "@leadgen/core/billing/abandoned";
import { runRetention } from "@leadgen/core/privacy/data";

// GET /api/jobs/retention: erases customers who are past their business's
// retention period, for every tenant, and removes signups that never added a
// card (billing/abandoned.ts), and clears old rate-limit counters. Run weekly by Vercel Cron (vercel.json), which
// sends "Authorization: Bearer $CRON_SECRET".
export async function GET(request: Request) {
  const refused = refuseUnlessCron(request);
  if (refused) return refused;
  const retention = await runRetention();
  let abandoned: Awaited<ReturnType<typeof removeAbandonedSignups>> | { abandonedSignupsError: true };
  try {
    abandoned = await removeAbandonedSignups();
  } catch (error) {
    console.error("Removing abandoned signups failed", error);
    abandoned = { abandonedSignupsError: true };
  }
  let rateLimitRowsCleared: number | null = null;
  try {
    rateLimitRowsCleared = await pruneRateLimits();
  } catch (error) {
    console.error("Clearing old rate-limit counters failed", error);
  }
  return Response.json({ ok: true, ...retention, ...abandoned, rateLimitRowsCleared });
}
