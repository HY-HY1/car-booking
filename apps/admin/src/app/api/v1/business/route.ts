import { getBusiness } from "@leadgen/core/api/data";
import { apiRoute, json } from "@/lib/api";

// GET /api/v1/business: name, contact details, branding, where and when the
// business works, and its booking rules. Docs: (marketing)/docs/api/business.
export const GET = apiRoute("catalog:read", async ({ key }) => json(await getBusiness(key.tenantId)));
