import { refuseUnlessCron } from "@leadgen/core/cron-auth";
import { runCalendarJobs } from "@leadgen/core/calendar/sync";

// GET /api/jobs/calendar: Google Calendar housekeeping for every business
// that has connected it. Renews push channels before they run out, rereads
// every calendar, and writes any job event that's missing, out of date or
// failed last time. Daily (vercel.json); same CRON_SECRET as the other jobs.
export async function GET(request: Request) {
  const refused = refuseUnlessCron(request);
  if (refused) return refused;
  return Response.json({ ok: true, ...(await runCalendarJobs()) });
}
