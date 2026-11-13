import { listCustomers, timezoneOf } from "@leadgen/core/api/data";
import { parseCustomerList } from "@leadgen/core/api/query";
import { apiRoute, badParam, json } from "@/lib/api";

// GET /api/v1/customers: customers, newest first, a page at a time. Anyone
// whose details were erased is left out. Docs: (marketing)/docs/api/customers.
export const GET = apiRoute("customers:read", async ({ url, key }) => {
  const params = parseCustomerList(url.searchParams, (await timezoneOf(key.tenantId)) ?? "Europe/London");
  if (!params.ok) return badParam(params);
  return json(await listCustomers(key.tenantId, params.value));
});
