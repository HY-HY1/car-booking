"use server";

import { redirect } from "next/navigation";
import { getOpenCheckoutUrl } from "@leadgen/core/stripe/checkout";
import { requireRequestTenant } from "@/lib/tenant";
import { pageUrl } from "@/lib/urls";

// "Pay deposit" on the page the customer lands on after leaving Stripe's
// checkout early: back to the same Checkout Session if it's still open.
export async function resumePaymentAction(bookingId: string) {
  const tenant = await requireRequestTenant();
  const url = await getOpenCheckoutUrl(tenant.id, bookingId);
  redirect(url ?? pageUrl(tenant, `/confirmed/${bookingId}?cancelled=1`));
}
