"use server";

import { assessCondition } from "@leadgen/core/booking/assess";
import {
  checkArea,
  confirmBooking,
  findOpenDates,
  findSlots,
  holdSlot,
  saveLead,
  type HoldRequest,
  type LeadRequest,
  type OpenDatesRequest,
  type SlotRequest,
} from "@leadgen/core/booking/engine";
import { removePendingPhoto, storePhoto } from "@leadgen/core/photos";
import { createDepositCheckout } from "@leadgen/core/stripe/checkout";
import { releaseHold } from "@leadgen/core/stripe/payments";
import { getRequestTenant } from "@/lib/tenant";
import { pageUrl } from "@/lib/urls";

// Server actions for the booking form. The tenant always comes from the
// URL, through the proxy; the browser only sends answers, which the engine
// validates.

async function requestTenant() {
  const tenant = await getRequestTenant();
  if (!tenant) throw new Error("No tenant for this request");
  return tenant;
}

async function tenantId() {
  return (await requestTenant()).id;
}

export async function checkAreaAction(postcode: string) {
  return checkArea(await tenantId(), postcode);
}

export async function saveLeadAction(input: LeadRequest) {
  return saveLead(await tenantId(), input);
}

export async function findOpenDatesAction(input: OpenDatesRequest) {
  return findOpenDates(await tenantId(), input);
}

export async function findSlotsAction(input: SlotRequest) {
  return findSlots(await tenantId(), input);
}

export async function bookAction(input: HoldRequest) {
  const tenant = await requestTenant();
  const id = tenant.id;
  const hold = await holdSlot(id, input);
  if (!hold.ok) return hold;

  // Deposit due and Stripe connected: the slot stays held while the customer
  // pays on Stripe's page, and the webhook confirms the booking once it lands.
  if (hold.depositCheckout) {
    const d = hold.depositCheckout;
    try {
      const checkoutUrl = await createDepositCheckout({
        tenantId: id,
        bookingId: hold.bookingId,
        leadId: d.leadId,
        stripeAccountId: d.stripeAccountId,
        depositPence: d.depositPence,
        description: d.description,
        customerEmail: d.customerEmail,
        confirmedUrl: pageUrl(tenant, `/confirmed/${hold.bookingId}`, { absolute: true }),
      });
      return { ok: true as const, bookingId: hold.bookingId, checkoutUrl };
    } catch (error) {
      console.error("Couldn't start the deposit checkout", error);
      await releaseHold(id, hold.bookingId);
      return {
        ok: false as const,
        code: "payment_unavailable",
        message: "We couldn't start the payment. Please try again in a moment.",
      };
    }
  }

  // No online deposit (none due, or Stripe isn't connected): confirmed as
  // soon as it's held (or sent to the owner to approve), and the owner
  // collects any deposit themselves.
  const confirmed = await confirmBooking(id, hold.bookingId);
  if (!confirmed.ok) return confirmed;
  return { ok: true as const, bookingId: hold.bookingId, checkoutUrl: null, status: confirmed.status };
}

export async function uploadPhotoAction(formData: FormData) {
  return storePhoto(await tenantId(), formData.get("photo"), {
    width: Number(formData.get("width")),
    height: Number(formData.get("height")),
  });
}

// Rates the car's condition from its photos. The booking form sends back the
// check's id; quotes read the level from the stored check.
export async function assessPhotosAction(photoIds: string[]) {
  return assessCondition(await tenantId(), photoIds);
}

export async function removePhotoAction(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  await removePendingPhoto(await tenantId(), id);
}
