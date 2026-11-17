import "server-only";
import { tenantUrl } from "../urls";
import { signConfirmedKey, signManageToken, verifyConfirmedKey } from "./manage-rules";

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

// The confirmation page for the browser that made the booking, with the key
// that shows it the manage link (manage-rules.ts). A path, plus `?k=…` when
// BOOKING_LINK_SECRET is set.
export async function confirmedPath(tenantId: string, bookingId: string) {
  const secret = process.env.BOOKING_LINK_SECRET;
  const path = `/confirmed/${bookingId}`;
  return secret ? `${path}?k=${await signConfirmedKey(secret, tenantId, bookingId)}` : path;
}

export async function confirmedKeyValid(tenantId: string, bookingId: string, key: unknown) {
  const secret = process.env.BOOKING_LINK_SECRET;
  return Boolean(secret) && typeof key === "string" && (await verifyConfirmedKey(secret!, tenantId, bookingId, key));
}
