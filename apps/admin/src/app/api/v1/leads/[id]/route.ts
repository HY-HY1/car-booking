import { z } from "zod";
import { getLead } from "@leadgen/core/api/data";
import { apiRoute, json, notFound } from "@/lib/api";

// GET /api/v1/leads/{id}. Docs: (marketing)/docs/api/leads.
export const GET = apiRoute<{ id: string }>("leads:read", async ({ key, params }) => {
  if (!z.uuid().safeParse(params.id).success) return notFound("lead");
  const lead = await getLead(key.tenantId, params.id);
  return lead ? json(lead) : notFound("lead");
});
