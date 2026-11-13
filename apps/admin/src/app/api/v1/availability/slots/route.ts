import { timezoneOf } from "@leadgen/core/api/data";
import { parseDate, parseJob } from "@leadgen/core/api/query";
import type { AvailableSlots } from "@leadgen/core/api/types";
import { findSlots, quote } from "@leadgen/core/booking/engine";
import { apiRoute, badParam, engineError, json, notSetUp } from "@/lib/api";

// GET /api/v1/availability/slots?date=&serviceId=&sizeClass=&locationType=[&addOnIds=][&postcode=]
// The free start times on one day for this job. Docs: (marketing)/docs/api/availability.
export const GET = apiRoute("catalog:read", async ({ url, key }) => {
  const job = parseJob(url.searchParams);
  if (!job.ok) return badParam(job);
  const date = parseDate(url.searchParams);
  if (!date.ok) return badParam(date);
  const timezone = await timezoneOf(key.tenantId);
  if (!timezone) return notSetUp();

  const [found, priced] = await Promise.all([
    findSlots(key.tenantId, { ...job.value, date: date.value }),
    quote(key.tenantId, job.value),
  ]);
  if (!found.ok) return engineError(found);
  if (!priced.ok) return engineError(priced);
  const body: AvailableSlots = { date: found.date, durationMins: priced.quote.duration_mins, timezone, slots: found.slots };
  return json(body);
});
