import { refuseUnlessCron } from "@leadgen/core/cron-auth";
import { runScheduledEmails } from "@leadgen/core/email/notify";

// GET /api/jobs/emails: reminders, aftercare and review requests, and alerts
// about enquiries that didn't book, for every tenant. Meant to run every 15
// minutes; Vercel Cron (vercel.json) runs it daily on the Hobby plan, so a
// more frequent caller sends "Authorization: Bearer $CRON_SECRET" too.
export async function GET(request: Request) {
  const refused = refuseUnlessCron(request);
  if (refused) return refused;
  return Response.json({ ok: true, ...(await runScheduledEmails()) });
}
