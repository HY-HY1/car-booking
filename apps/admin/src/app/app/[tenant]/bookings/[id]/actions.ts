"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { approveBooking, declineBooking } from "@leadgen/core/booking/approval";
import { createBookingBalanceLink } from "@leadgen/core/stripe/payment-links";
import { refundDeposit } from "@leadgen/core/stripe/payments";
import { requireTenant } from "@/lib/auth";

// Refunds the deposit through the owner's Stripe account: in full, or the
// amount given (what the cancellation policy says to give back). Owner-only,
// and the booking is looked up within the tenant from the URL's membership
// check, never a tenant id from the form.
export async function refundDepositAction(
  slug: string,
  bookingId: string,
  amountPence?: number,
): Promise<{ message?: string }> {
  const { tenant, can } = await requireTenant(slug);
  if (!can("money")) return { message: "Your access level doesn't include refunds." };

  const result = await refundDeposit(tenant.id, bookingId, amountPence);
  if (!result.ok) return { message: result.message };
  refresh();
  return {};
}

// Approve or decline a booking that's waiting for approval: anyone who
// manages bookings (not technicians).
export async function approveBookingAction(slug: string, bookingId: string): Promise<{ message?: string }> {
  const { tenant, can } = await requireTenant(slug);
  if (!can("bookings.manage")) return { message: "Your access level doesn't include approving bookings." };
  if (!z.uuid().safeParse(bookingId).success) return { message: "That booking no longer exists." };
  try {
    const result = await approveBooking(tenant.id, bookingId);
    if (!result.ok) return { message: result.message };
  } catch (error) {
    console.error("Approving a booking failed", error);
    return { message: "Couldn't approve the booking. Try again." };
  }
  refresh();
  return {};
}

export async function declineBookingAction(
  slug: string,
  bookingId: string,
  reason: string,
): Promise<{ message?: string; warning?: string }> {
  const { tenant, can } = await requireTenant(slug);
  if (!can("bookings.manage")) return { message: "Your access level doesn't include declining bookings." };
  if (!z.uuid().safeParse(bookingId).success) return { message: "That booking no longer exists." };
  try {
    const result = await declineBooking(tenant.id, bookingId, reason.trim().slice(0, 500) || null);
    if (!result.ok) return { message: result.message };
    refresh();
    return { warning: "warning" in result ? result.warning : undefined };
  } catch (error) {
    console.error("Declining a booking failed", error);
    return { message: "Couldn't decline the booking. Try again." };
  }
}

export type BalanceLinkState = { error?: string; link?: { url: string; description: string; amountPence: number } };

// "Create payment": a one-off link for what's still owed on this booking. The
// amount is worked out on the server, so it can't be set from the browser.
export async function createBalanceLinkAction(slug: string, bookingId: string): Promise<BalanceLinkState> {
  const { tenant, can, user } = await requireTenant(slug);
  if (!can("money")) return { error: "Your access level doesn't include payment links." };

  try {
    const result = await createBookingBalanceLink(tenant.id, user.id, bookingId);
    if (!result.ok) return { error: result.message };
    refresh();
    return { link: result.link };
  } catch (error) {
    console.error("Creating a booking payment link failed", error);
    return { error: "Couldn't create the link. Try again." };
  }
}
