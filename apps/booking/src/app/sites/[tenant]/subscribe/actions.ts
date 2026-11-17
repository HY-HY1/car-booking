"use server";

import { confirmMarketingConsent } from "@leadgen/core/privacy/data";
import { getRequestTenant } from "@/lib/tenant";
import { optInClaim } from "@/lib/unsubscribe";

export type SubscribeState = { done?: boolean; error?: string };

// The button on /subscribe. The tenant comes from the address, never the form.
export async function subscribeAction(_: SubscribeState, formData: FormData): Promise<SubscribeState> {
  const tenant = await getRequestTenant();
  if (!tenant) return { error: "Something went wrong. Please try again." };
  try {
    const claim = await optInClaim(tenant.id, String(formData.get("t") ?? ""));
    if (!claim) return { error: "That link isn't valid any more." };
    await confirmMarketingConsent(tenant.id, claim.customerId);
    return { done: true };
  } catch (error) {
    console.error("Subscribe failed", error);
    return { error: "Something went wrong. Please try again." };
  }
}
