"use server";

import { getRequestTenant } from "@/lib/tenant";
import { unsubscribeWithToken } from "@/lib/unsubscribe";

export type UnsubscribeState = { done?: boolean; error?: string };

// The button on /unsubscribe. The tenant comes from the address, never the form.
export async function unsubscribeAction(_: UnsubscribeState, formData: FormData): Promise<UnsubscribeState> {
  const tenant = await getRequestTenant();
  if (!tenant) return { error: "Something went wrong. Please try again." };
  try {
    const ok = await unsubscribeWithToken(tenant.id, String(formData.get("t") ?? ""));
    return ok ? { done: true } : { error: "That link isn't valid any more." };
  } catch (error) {
    console.error("Unsubscribe failed", error);
    return { error: "Something went wrong. Please try again." };
  }
}
