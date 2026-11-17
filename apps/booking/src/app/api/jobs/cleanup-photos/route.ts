import { refuseUnlessCron } from "@leadgen/core/cron-auth";
import { cleanupExpiredPhotos, cleanupPendingPhotos } from "@leadgen/core/photos";

// GET /api/jobs/cleanup-photos: deletes photo uploads that never became an
// enquiry, and photos past each business's retention setting, for every
// tenant. Run daily by Vercel Cron (vercel.json), which
// sends "Authorization: Bearer $CRON_SECRET". Uploads also tidy up their own
// tenant as they go, so this only catches tenants with no new uploads.
export async function GET(request: Request) {
  const refused = refuseUnlessCron(request);
  if (refused) return refused;
  const deleted = await cleanupPendingPhotos();
  const expired = await cleanupExpiredPhotos();
  return Response.json({ ok: true, deleted, expired });
}
