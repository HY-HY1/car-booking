import { createWebhook, listWebhooks } from "@leadgen/core/api/data";
import { bodyProblem, createWebhookSchema } from "@leadgen/core/api/query";
import type { CreatedWebhook } from "@leadgen/core/api/types";
import { isWebhookEvent, WEBHOOK_EVENT_KEYS } from "@leadgen/core/webhooks/events";
import { recordActivity } from "@leadgen/core/activity/log";
import { apiError, apiRoute, json, jsonBody } from "@/lib/api";

// GET /api/v1/webhooks: the business's webhooks.
// POST /api/v1/webhooks: add one, for tools that subscribe themselves (such
// as a Zapier integration). The same webhooks as Settings → Integrations.
// Docs: (marketing)/docs/api/webhooks.

export const GET = apiRoute("webhooks:write", async ({ key }) => json({ data: await listWebhooks(key.tenantId) }));

export const POST = apiRoute("webhooks:write", async ({ request, key }) => {
  const body = await jsonBody(request);
  if (!body) return apiError(400, "invalid_request", "Send a JSON object, with Content-Type: application/json.");
  const parsed = createWebhookSchema.safeParse(body);
  if (!parsed.success) {
    const { message, param } = bodyProblem(parsed.error);
    return apiError(400, "invalid_request", message, param);
  }
  const unknown = parsed.data.events.find((e) => !isWebhookEvent(e));
  if (unknown !== undefined) {
    return apiError(400, "invalid_request", `"${unknown}" isn't an event. Use any of: ${WEBHOOK_EVENT_KEYS.join(", ")}.`, "events");
  }

  const made = await createWebhook(key.tenantId, {
    url: parsed.data.url,
    events: [...new Set(parsed.data.events.filter(isWebhookEvent))],
    description: parsed.data.description ?? `Added by the API key "${key.keyName}"`,
  });
  if ("error" in made) {
    return made.code === "limit_reached"
      ? apiError(409, "limit_reached", made.error)
      : apiError(400, "invalid_request", made.error, "url");
  }
  await recordActivity({ tenantId: key.tenantId, actorId: null, actorEmail: null, action: "settings.webhook_added", summary: `Added a webhook with the API key ${key.keyName}` });
  const created: CreatedWebhook = { ...made.webhook, secret: made.secret };
  return json(created, { status: 201 });
});
