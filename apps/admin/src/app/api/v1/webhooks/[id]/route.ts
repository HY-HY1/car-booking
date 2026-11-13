import { z } from "zod";
import { deleteWebhook, getWebhook } from "@leadgen/core/api/data";
import { recordActivity } from "@leadgen/core/activity/log";
import { apiRoute, json, notFound } from "@/lib/api";

// GET and DELETE /api/v1/webhooks/{id}. Docs: (marketing)/docs/api/webhooks.

export const GET = apiRoute<{ id: string }>("webhooks:write", async ({ key, params }) => {
  if (!z.uuid().safeParse(params.id).success) return notFound("webhook");
  const webhook = await getWebhook(key.tenantId, params.id);
  return webhook ? json(webhook) : notFound("webhook");
});

export const DELETE = apiRoute<{ id: string }>("webhooks:write", async ({ key, params }) => {
  if (!z.uuid().safeParse(params.id).success) return notFound("webhook");
  if (!(await deleteWebhook(key.tenantId, params.id))) return notFound("webhook");
  await recordActivity({ tenantId: key.tenantId, actorId: null, actorEmail: null, action: "settings.webhook_deleted", summary: `Deleted a webhook with the API key ${key.keyName}` });
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
});
