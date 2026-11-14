import { removeAbandonedSignups } from "@leadgen/core/billing/abandoned";
import { runRetention } from "@leadgen/core/privacy/data";

// GET /api/jobs/retention: erases customers who are past their business's
// retention period, for every tenant, and removes signups that never added a
// card (billing/abandoned.ts). Run weekly by Vercel Cron (vercel.json), which
// sends "Authorization: Bearer $CRON_SECRET".
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("Not configured", { status: 404 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const retention = await runRetention();
  let abandoned: Awaited<ReturnType<typeof removeAbandonedSignups>> | { abandonedSignupsError: true };
  try {
    abandoned = await removeAbandonedSignups();
  } catch (error) {
    console.error("Removing abandoned signups failed", error);
    abandoned = { abandonedSignupsError: true };
  }
  return Response.json({ ok: true, ...retention, ...abandoned });
}
