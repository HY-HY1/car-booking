"use server";

import { redirect } from "next/navigation";
import {
  cancelBookingAsCustomer,
  findRescheduleDates,
  findRescheduleSlots,
  rescheduleBooking,
  startDepositPayment,
} from "@leadgen/core/booking/manage";
import { requireRequestTenant } from "@/lib/tenant";
import { pageUrl } from "@/lib/urls";

// The customer's own changes from /manage/<token>. The token is checked
// against the business for this hostname on every call (booking/manage.ts).

export async function findDatesAction(token: string) {
  const tenant = await requireRequestTenant();
  return findRescheduleDates(tenant.id, token);
}

export async function findSlotsAction(token: string, date: string) {
  const tenant = await requireRequestTenant();
  return findRescheduleSlots(tenant.id, token, date);
}

export async function rescheduleAction(token: string, startsAt: string) {
  const tenant = await requireRequestTenant();
  return rescheduleBooking(tenant.id, token, startsAt);
}

export async function cancelAction(token: string) {
  const tenant = await requireRequestTenant();
  return cancelBookingAsCustomer(tenant.id, token);
}

// "Pay deposit": off to Stripe, or back to the page saying why not.
export async function payDepositAction(token: string) {
  const tenant = await requireRequestTenant();
  const result = await startDepositPayment(tenant, token);
  redirect(result.ok ? result.url : pageUrl(tenant, `/manage/${token}?pay=unavailable`));
}
