import { timezoneOf } from "@leadgen/core/api/data";
import { parseJob } from "@leadgen/core/api/query";
import type { AvailableDates } from "@leadgen/core/api/types";
import { findOpenDates, quote } from "@leadgen/core/booking/engine";
import { apiRoute, badParam, engineError, json, notSetUp } from "@/lib/api";

// GET /api/v1/availability/dates?serviceId=&sizeClass=&locationType=[&addOnIds=][&postcode=]
// Every date in the booking window with at least one free start time for
// this job. Docs: (marketing)/docs/api/availability.
export const GET = apiRoute("catalog:read", async ({ url, key }) => {
  const job = parseJob(url.searchParams);
  if (!job.ok) return badParam(job);
  const timezone = await timezoneOf(key.tenantId);
  if (!timezone) return notSetUp();

  const [dates, priced] = await Promise.all([findOpenDates(key.tenantId, job.value), quote(key.tenantId, job.value)]);
  if (!dates.ok) return engineError(dates);
  if (!priced.ok) return engineError(priced);
  const body: AvailableDates = { durationMins: priced.quote.duration_mins, timezone, dates: dates.dates };
  return json(body);
});
