import { tenantBasics, timezoneOf } from "@leadgen/core/api/data";
import { parseJob } from "@leadgen/core/api/query";
import { quoteResource } from "@leadgen/core/api/resources";
import { quote } from "@leadgen/core/booking/engine";
import { apiRoute, badParam, engineError, json, notSetUp } from "@/lib/api";

// GET /api/v1/quote?serviceId=&sizeClass=&locationType=[&addOnIds=][&postcode=]
// The price for a job, worked out by the same engine as the booking form.
// Docs: (marketing)/docs/api/quote.
export const GET = apiRoute("catalog:read", async ({ url, key }) => {
  const job = parseJob(url.searchParams);
  if (!job.ok) return badParam(job);
  if (!(await timezoneOf(key.tenantId))) return notSetUp();

  const [result, tenant] = await Promise.all([quote(key.tenantId, job.value), tenantBasics(key.tenantId)]);
  if (!result.ok) return engineError(result);
  return json(quoteResource(result.quote, tenant.url(`/quote?service=${job.value.serviceId}`)));
});
