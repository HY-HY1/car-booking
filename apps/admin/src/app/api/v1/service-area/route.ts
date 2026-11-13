import { timezoneOf } from "@leadgen/core/api/data";
import { postcodeOf } from "@leadgen/core/api/query";
import type { ServiceAreaCheck } from "@leadgen/core/api/types";
import { checkArea, getBookingConfig } from "@leadgen/core/booking/engine";
import { apiRoute, badParam, engineError, json, notSetUp } from "@/lib/api";

// GET /api/v1/service-area?postcode=: whether the business comes out to a
// postcode. Docs: (marketing)/docs/api/service-area.
export const GET = apiRoute("catalog:read", async ({ url, key }) => {
  const postcode = postcodeOf(url.searchParams, true);
  if (!postcode.ok) return badParam(postcode);
  const value = postcode.value!;
  if (!(await timezoneOf(key.tenantId))) return notSetUp();

  const config = await getBookingConfig(key.tenantId);
  if (!config?.settings.offers_mobile) {
    const body: ServiceAreaCheck = {
      postcode: value,
      covered: false,
      message: config?.settings.offers_unit
        ? "We don't come out to customers. Drop your car off with us instead."
        : "We aren't taking bookings at the moment.",
    };
    return json(body);
  }

  const result = await checkArea(key.tenantId, value);
  if (result.ok) return json({ postcode: value, covered: true, message: null } satisfies ServiceAreaCheck);
  if (result.code === "outside_area") return json({ postcode: value, covered: false, message: result.message } satisfies ServiceAreaCheck);
  return engineError(result);
});
