import { listBookings, timezoneOf } from "@leadgen/core/api/data";
import { parseBookingList } from "@leadgen/core/api/query";
import { apiRoute, badParam, json } from "@/lib/api";

// GET /api/v1/bookings: bookings in the order they happen, a page at a time.
// Docs: (marketing)/docs/api/bookings.
export const GET = apiRoute("bookings:read", async ({ url, key }) => {
  const params = parseBookingList(url.searchParams, (await timezoneOf(key.tenantId)) ?? "Europe/London");
  if (!params.ok) return badParam(params);
  return json(await listBookings(key.tenantId, params.value));
});
