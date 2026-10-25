import "server-only";
import { notifyBookingDeclined, notifyBookingSecured } from "../email/notify";
import { createAdminClient } from "../supabase/admin";
import { refundDeposit } from "../stripe/payments";

// Bookings waiting for the owner's approval ('requested', when Settings →
// Booking is set to approve each one). Callers check the user is a member of
// `tenantId` first; every write is filtered on it.

export async function approveBooking(tenantId: string, bookingId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("bookings")
    .update({ status: "confirmed" })
    .eq("tenant_id", tenantId)
    .eq("id", bookingId)
    .eq("status", "requested")
    .select("id, lead_id")
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false as const, message: "This booking isn't waiting for approval any more. Reload the page." };
  if (data.lead_id) {
    const lead = await db.from("leads").update({ status: "booked" }).eq("tenant_id", tenantId).eq("id", data.lead_id);
    if (lead.error) throw lead.error;
  }
  // The business approved it, so only the customer needs telling.
  await notifyBookingSecured(tenantId, bookingId, { alertOwner: false });
  return { ok: true as const };
}

// Turning a request down frees the slot and gives back any deposit in full:
// the customer never had a booking to cancel.
export async function declineBooking(tenantId: string, bookingId: string, reason: string | null) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("bookings")
    .update({ status: "cancelled", decline_reason: reason })
    .eq("tenant_id", tenantId)
    .eq("id", bookingId)
    .eq("status", "requested")
    .select("id, deposit_status")
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false as const, message: "This booking isn't waiting for approval any more. Reload the page." };

  // Refund first, so the email can say the deposit is on its way back.
  const refund = data.deposit_status === "paid" ? await refundDeposit(tenantId, bookingId) : null;
  await notifyBookingDeclined(tenantId, bookingId);
  if (refund && !refund.ok) {
    return {
      ok: true as const,
      warning: `Declined, but the deposit couldn't be refunded: ${refund.message} Refund it from the booking page.`,
    };
  }
  return { ok: true as const };
}
