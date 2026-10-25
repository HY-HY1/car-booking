"use server";

import { notFound, redirect } from "next/navigation";
import { hasAccess } from "@leadgen/core/billing/rules";
import { hostedCheckoutUrl } from "@/lib/billing";
import { getMemberships, requireUser } from "@/lib/auth";
import { appUrl } from "@/lib/urls";

// "Start my free trial" / "Resubscribe": on to Stripe Checkout. Only the
// owner of the business can start a subscription for it.
export async function startCheckoutAction(slug: string) {
  const user = await requireUser(appUrl(`/signup/billing?tenant=${encodeURIComponent(slug)}`));
  const membership = (await getMemberships()).find((m) => m.tenant.slug === slug);
  if (!membership) notFound();
  if (membership.role !== "owner") throw new Error("Only the business owner can start the subscription.");
  if (hasAccess(membership.tenant.subscription_status)) redirect(appUrl(`/${slug}`));

  // The recovery page sends people to Stripe's own payment page.
  let url: string | null = null;
  try {
    url = await hostedCheckoutUrl(membership.tenant, user.email);
  } catch (error) {
    console.error("Couldn't start Stripe Checkout", error);
  }
  redirect(url ?? appUrl(`/signup/billing?tenant=${encodeURIComponent(slug)}&error=1`));
}
