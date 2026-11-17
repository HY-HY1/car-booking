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
import { confirmedPath } from "@leadgen/core/booking/manage-link";
import { findPromo } from "@leadgen/core/booking/promo";
import { removePendingPhoto, storePhoto } from "@leadgen/core/photos";
import { createDepositCheckout } from "@leadgen/core/stripe/checkout";
import { releaseHold } from "@leadgen/core/stripe/payments";
import { isHuman, NOT_HUMAN } from "@leadgen/core/turnstile";
import { TOO_MANY, visitorIp, withinLimit, type LimitName } from "@/lib/limits";
import { getRequestTenant } from "@/lib/tenant";
import { pageUrl } from "@/lib/urls";

// Server actions for the booking form. The tenant always comes from the
// URL, through the proxy; the browser only sends answers, which the engine
// validates. Anyone can call these, so each one is rate limited (lib/limits.ts),
// and the two that email people also need a pass from the bot check
// (Turnstile, when it's set up).

async function requestTenant() {
  const tenant = await getRequestTenant();
  if (!tenant) throw new Error("No tenant for this request");
  return tenant;
}

async function tenantId() {
  return (await requestTenant()).id;
}

const tooMany = { ok: false as const, code: "rate_limited", message: TOO_MANY };
const notHuman = { ok: false as const, code: "not_human", message: NOT_HUMAN };

// The tenant's id, or null if this visitor or business is over the limit.
async function limitedTenantId(name: LimitName) {
  const id = await tenantId();
  return (await withinLimit(name, id)) ? id : null;
}

export async function checkAreaAction(postcode: string) {
  const id = await limitedTenantId("lookup");
  return id ? checkArea(id, postcode) : tooMany;
}

export async function checkPromoAction(code: string) {
  const id = await limitedTenantId("promo");
  return id ? findPromo(id, code) : tooMany;
}

export async function saveLeadAction(input: LeadRequest, human?: string | null) {
  if (!(await isHuman(human, await visitorIp()))) return notHuman;
  const id = await limitedTenantId("lead");
  return id ? saveLead(id, input) : tooMany;
}

export async function findOpenDatesAction(input: OpenDatesRequest) {
  const id = await limitedTenantId("lookup");
  return id ? findOpenDates(id, input) : tooMany;
}

export async function findSlotsAction(input: SlotRequest) {
  const id = await limitedTenantId("lookup");
  return id ? findSlots(id, input) : tooMany;
}

export async function bookAction(input: HoldRequest, human?: string | null) {
  if (!(await isHuman(human, await visitorIp()))) return notHuman;
  const tenant = await requestTenant();
  const id = tenant.id;
  if (!(await withinLimit("book", id))) return tooMany;
  const hold = await holdSlot(id, input);
  if (!hold.ok) return hold;
  // With the key that shows this browser the manage link (manage-rules.ts).
  const confirmed = await confirmedPath(id, hold.bookingId);

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
        confirmedUrl: pageUrl(tenant, confirmed, { absolute: true }),
      });
      return { ok: true as const, bookingId: hold.bookingId, confirmedPath: confirmed, checkoutUrl };
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
  const done = await confirmBooking(id, hold.bookingId);
  if (!done.ok) return done;
  return { ok: true as const, bookingId: hold.bookingId, confirmedPath: confirmed, checkoutUrl: null, status: done.status };
}

export async function uploadPhotoAction(formData: FormData) {
  const id = await limitedTenantId("photo");
  if (!id) return { ok: false as const, message: TOO_MANY };
  return storePhoto(id, formData.get("photo"), {
    width: Number(formData.get("width")),
    height: Number(formData.get("height")),
  });
}

// Rates the car's condition from its photos. The booking form sends back the
// check's id; quotes read the level from the stored check. Each check is a
// paid call to Claude, hence the daily cap per business as well as per visitor.
export async function assessPhotosAction(photoIds: string[]) {
  const id = await limitedTenantId("assess");
  return id ? assessCondition(id, photoIds) : tooMany;
}

export async function removePhotoAction(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  await removePendingPhoto(await tenantId(), id);
}
