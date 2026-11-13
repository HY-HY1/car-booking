import { z } from "zod";
import { getCustomer } from "@leadgen/core/api/data";
import { apiRoute, json, notFound } from "@/lib/api";

// GET /api/v1/customers/{id}. Docs: (marketing)/docs/api/customers.
export const GET = apiRoute<{ id: string }>("customers:read", async ({ key, params }) => {
  if (!z.uuid().safeParse(params.id).success) return notFound("customer");
  const customer = await getCustomer(key.tenantId, params.id);
  return customer ? json(customer) : notFound("customer");
});
