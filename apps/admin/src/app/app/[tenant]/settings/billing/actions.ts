"use server";

import { redirect } from "next/navigation";
import { billingPortalUrl } from "@/lib/billing";
import { requireTenant } from "@/lib/auth";
import { appUrl } from "@/lib/urls";

// "Manage billing": on to Stripe's billing portal (plan, card, invoices,
// cancelling). Owner only.
export async function manageSubscriptionAction(slug: string) {
  const { tenant, can } = await requireTenant(slug);
  if (!can("billing")) throw new Error("Only the business owner can manage billing.");
  let url: string | null = null;
  try {
    url = await billingPortalUrl(tenant);
  } catch (error) {
    console.error("Couldn't open the Stripe billing portal", error);
  }
  redirect(url ?? appUrl(`/${encodeURIComponent(slug)}/settings/billing?error=1`));
}
