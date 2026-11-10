import "server-only";
import { syncBookingEvent } from "../calendar/sync";
import { sendBookingWebhooks } from "../webhooks/deliver";

// Called wherever a booking is made, approved, declined, cancelled, moved,
// edited, paid, done, a no-show or put back. Tells everything outside that
// keeps a copy: Google Calendar and the business's webhooks. Never throws.
export async function bookingChanged(tenantId: string, bookingId: string) {
  await Promise.all([syncBookingEvent(tenantId, bookingId), sendBookingWebhooks(tenantId, bookingId)]);
}
