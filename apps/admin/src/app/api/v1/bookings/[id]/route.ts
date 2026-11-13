import { z } from "zod";
import { getBooking } from "@leadgen/core/api/data";
import { apiRoute, json, notFound } from "@/lib/api";

// GET /api/v1/bookings/{id}. Docs: (marketing)/docs/api/bookings.
export const GET = apiRoute<{ id: string }>("bookings:read", async ({ key, params }) => {
  if (!z.uuid().safeParse(params.id).success) return notFound("booking");
  const booking = await getBooking(key.tenantId, params.id);
  return booking ? json(booking) : notFound("booking");
});
