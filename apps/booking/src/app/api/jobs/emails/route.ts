import { runScheduledEmails } from "@leadgen/core/email/notify";

// GET /api/jobs/emails: reminders, aftercare and review requests, and alerts
// about enquiries that didn't book, for every tenant. Meant to run every 15
// minutes; Vercel Cron (vercel.json) runs it daily on the Hobby plan, so a
// more frequent caller sends "Authorization: Bearer $CRON_SECRET" too.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("Not configured", { status: 404 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json({ ok: true, ...(await runScheduledEmails()) });
}
