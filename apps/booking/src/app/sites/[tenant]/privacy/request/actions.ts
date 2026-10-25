"use server";

import { logPublicRequest } from "@leadgen/core/privacy/data";
import { publicRequestSchema } from "@leadgen/core/privacy/rules";
import { getRequestTenant } from "@/lib/tenant";

export type RequestState = { errors?: Record<string, string>; message?: string; done?: boolean };

// The tenant comes from the hostname, never the form. Nothing is released or
// erased here: the request just lands in the owner's list with a one-month
// deadline, and they check who's asking before acting.
export async function submitRequestAction(_: RequestState, formData: FormData): Promise<RequestState> {
  const tenant = await getRequestTenant();
  if (!tenant) return { message: "Something went wrong. Please try again." };

  const parsed = publicRequestSchema.safeParse({
    kind: formData.get("kind"),
    name: formData.get("name"),
    email: formData.get("email"),
    details: formData.get("details") || undefined,
    website: formData.get("website") || undefined,
  });
  if (!parsed.success) {
    // A filled honeypot looks like success to the bot.
    if (parsed.error.issues.some((i) => i.path[0] === "website")) return { done: true };
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    return { errors };
  }

  try {
    await logPublicRequest(tenant.id, parsed.data);
  } catch (error) {
    console.error("Couldn't log privacy request", error);
    return { message: "We couldn't send that. Please try again, or email us." };
  }
  return { done: true };
}
