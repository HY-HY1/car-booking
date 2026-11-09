import "server-only";
import { tenantUrl } from "../urls";
import { signManageToken } from "./manage-rules";

// The "Manage your booking" link in a customer's emails, on the business's
// own booking pages. Null without BOOKING_LINK_SECRET: the emails then go
// without it rather than with a link that can't open.
export async function manageBookingUrl(
  tenant: { id: string; slug: string; customDomain: string | null },
  bookingId: string,
): Promise<string | null> {
  const secret = process.env.BOOKING_LINK_SECRET;
  if (!secret) return null;
  const token = await signManageToken(secret, tenant.id, bookingId);
  return tenantUrl(tenant.slug, `/manage/${token}`, { absolute: true, customDomain: tenant.customDomain });
}
