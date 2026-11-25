"use server";

import { saveEnquiry, type EnquiryResult } from "@leadgen/core/enquiry/save";
import { isHuman, NOT_HUMAN } from "@leadgen/core/turnstile";
import { TOO_MANY, visitorIp, withinLimit } from "@/lib/limits";
import { getRequestTenant } from "@/lib/tenant";

// Sends an enquiry from the business's enquiry page. The tenant comes from
// the URL, through the proxy; anyone can call this, so it's rate limited and
// needs a pass from the bot check (Turnstile, when it's set up).
export async function sendEnquiryAction(input: unknown, human?: string | null): Promise<EnquiryResult> {
  const tenant = await getRequestTenant();
  if (!tenant || !tenant.branding.extras.enquiries.show) return { ok: false, message: "This business isn't taking enquiries here." };
  if (!(await isHuman(human, await visitorIp()))) return { ok: false, message: NOT_HUMAN };
  if (!(await withinLimit("enquiry", tenant.id))) return { ok: false, message: TOO_MANY };
  try {
    return await saveEnquiry(tenant.id, input);
  } catch (error) {
    console.error("Saving an enquiry failed", error);
    return { ok: false, message: "Something went wrong sending that. Please try again in a moment." };
  }
}
