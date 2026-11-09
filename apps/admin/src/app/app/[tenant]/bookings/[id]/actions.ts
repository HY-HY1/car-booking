"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { approveBooking, declineBooking } from "@leadgen/core/booking/approval";
import { recordOfflinePayment, removeOfflinePayment } from "@leadgen/core/booking/offline-payments";
import { emailDepositRequest, emailPaymentLink } from "@leadgen/core/email/notify";
import { createBookingBalanceLink } from "@leadgen/core/stripe/payment-links";
import { offlinePaymentSchema } from "@leadgen/core/stripe/payment-rules";
import { refundDeposit } from "@leadgen/core/stripe/payments";
import { requireTenant } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

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

export type BalanceLinkState = {
  error?: string;
  link?: { url: string; description: string; amountPence: number };
  // Set when the link was emailed: who to.
  sentTo?: string;
};

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

// "Email payment link": the link for what's still owed (the live one if it
// was already made), emailed to the booking's customer. The address comes
// from the booking, not the browser.
export async function emailBalanceLinkAction(slug: string, bookingId: string): Promise<BalanceLinkState> {
  const { tenant, can, user } = await requireTenant(slug);
  if (!can("money")) return { error: "Your access level doesn't include payment links." };
  if (!z.uuid().safeParse(bookingId).success) return { error: "That booking wasn't found." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("customer:customers(email)")
    .eq("tenant_id", tenant.id)
    .eq("id", bookingId)
    .maybeSingle();
  if (error) {
    console.error("Loading a booking's customer failed", error);
    return { error: "Couldn't send the link. Try again." };
  }
  const to = (data?.customer as unknown as { email: string | null } | null)?.email;
  if (!to) return { error: "This customer has no email address." };

  try {
    const result = await createBookingBalanceLink(tenant.id, user.id, bookingId, { reuse: true });
    if (!result.ok) return { error: result.message };
    const sent = await emailPaymentLink(tenant.id, result.link.id, to);
    refresh();
    if (!sent.ok) return { error: sent.message, link: result.link };
    return { link: result.link, sentTo: to };
  } catch (error) {
    console.error("Emailing a booking payment link failed", error);
    return { error: "Couldn't send the link. Try again." };
  }
}

// "Email deposit request": asks the customer to pay the deposit still owed
// from their booking page. Anyone who manages bookings can send it; it goes
// to the booking's own customer.
export async function emailDepositRequestAction(slug: string, bookingId: string): Promise<{ error?: string; sent?: boolean }> {
  const { tenant, can } = await requireTenant(slug);
  if (!can("bookings.manage")) return { error: "Your access level doesn't include asking for deposits." };
  if (!z.uuid().safeParse(bookingId).success) return { error: "That booking wasn't found." };
  const result = await emailDepositRequest(tenant.id, bookingId);
  return result.ok ? { sent: true } : { error: result.message };
}

export type OfflinePaymentState = {
  errors?: { method?: string; amount?: string; note?: string };
  message?: string;
  saved?: boolean;
};

// "Record payment": cash or a bank transfer, money taken outside Stripe,
// recorded against the booking. Owners and managers (money), like refunds
// and payment links.
export async function recordPaymentAction(
  slug: string,
  bookingId: string,
  _prev: OfflinePaymentState,
  formData: FormData,
): Promise<OfflinePaymentState> {
  const { tenant, can, user } = await requireTenant(slug);
  if (!can("money")) return { message: "Your access level doesn't include recording payments." };
  if (!z.uuid().safeParse(bookingId).success) return { message: "That booking wasn't found." };

  const parsed = offlinePaymentSchema.safeParse({
    method: formData.get("method") ?? "",
    amountPence: formData.get("amount") ?? "",
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    const fields = z.flattenError(parsed.error).fieldErrors;
    return { errors: { method: fields.method?.[0], amount: fields.amountPence?.[0], note: fields.note?.[0] } };
  }
  try {
    const result = await recordOfflinePayment(tenant.id, bookingId, parsed.data, user.id);
    if (!result.ok) return { message: result.message };
  } catch (error) {
    console.error("Recording a payment failed", error);
    return { message: "Couldn't record the payment. Try again." };
  }
  refresh();
  return { saved: true };
}

export async function removePaymentAction(slug: string, bookingId: string, paymentId: string): Promise<{ message?: string }> {
  const { tenant, can } = await requireTenant(slug);
  if (!can("money")) return { message: "Your access level doesn't include recording payments." };
  if (!z.uuid().safeParse(bookingId).success) return { message: "That booking wasn't found." };
  try {
    const result = await removeOfflinePayment(tenant.id, bookingId, paymentId);
    if (!result.ok) return { message: result.message };
  } catch (error) {
    console.error("Removing a payment failed", error);
    return { message: "Couldn't remove the payment. Try again." };
  }
  refresh();
  return {};
}
