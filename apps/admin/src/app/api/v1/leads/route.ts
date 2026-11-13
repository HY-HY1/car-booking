import { createLead, listLeads, timezoneOf } from "@leadgen/core/api/data";
import { bodyProblem, createLeadSchema, parseLeadList } from "@leadgen/core/api/query";
import { apiError, apiRoute, badParam, json, jsonBody } from "@/lib/api";

// GET /api/v1/leads: enquiries, newest first, a page at a time.
// POST /api/v1/leads: add one from a form on the business's own website.
// Docs: (marketing)/docs/api/leads.

export const GET = apiRoute("leads:read", async ({ url, key }) => {
  const params = parseLeadList(url.searchParams, (await timezoneOf(key.tenantId)) ?? "Europe/London");
  if (!params.ok) return badParam(params);
  return json(await listLeads(key.tenantId, params.value));
});

export const POST = apiRoute("leads:write", async ({ request, key }) => {
  const body = await jsonBody(request);
  if (!body) return apiError(400, "invalid_request", "Send a JSON object, with Content-Type: application/json.");
  const parsed = createLeadSchema.safeParse(body);
  if (!parsed.success) {
    const { message, param } = bodyProblem(parsed.error);
    return apiError(400, "invalid_request", message, param);
  }

  const result = await createLead(key.tenantId, parsed.data);
  if ("error" in result) return apiError(422, "unknown_service", "That service doesn't exist. Use a service id from /v1/catalog.", "serviceId");
  // 201 for a new lead; 200 when externalId matched one already sent.
  return json(result.lead, { status: result.created ? 201 : 200 });
});
