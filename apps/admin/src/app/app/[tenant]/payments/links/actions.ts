"use server";

import { refresh } from "next/cache";
import { createPaymentLink, deactivatePaymentLink, paymentLinkSchema, type CreatedPaymentLink } from "@leadgen/core/stripe/payment-links";
import { requireTenant } from "@/lib/auth";

// Owner-only (money). The business always comes from the URL's membership
// check, never from the form, and a booking id from the form is verified to
// belong to that business before it's attached.

export type CreateLinkState = {
  errors?: Record<string, string>;
  message?: string;
  values?: Record<string, string>;
  created?: CreatedPaymentLink;
};

export async function createLinkAction(slug: string, _prev: CreateLinkState, formData: FormData): Promise<CreateLinkState> {
  const { tenant, can, user } = await requireTenant(slug);
  if (!can("money")) return { message: "Your access level doesn't include payment links." };

  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) if (typeof value === "string") values[key] = value;

  const parsed = paymentLinkSchema.safeParse({
    description: String(formData.get("description") ?? ""),
    amountPence: String(formData.get("amount") ?? ""),
    singleUse: formData.get("singleUse") === "on",
    bookingId: String(formData.get("bookingId") ?? "") || undefined,
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] === "amountPence" ? "amount" : String(issue.path[0] ?? "form");
      errors[field] ??= issue.message;
    }
    return { errors, values };
  }

  try {
    const result = await createPaymentLink(tenant.id, user.id, parsed.data);
    if (!result.ok) return { message: result.message, values };
    refresh();
    return { created: result.link };
  } catch (error) {
    console.error("Creating a payment link failed", error);
    return { message: "Couldn't create the link. Try again.", values };
  }
}

export async function deactivateLinkAction(slug: string, id: string): Promise<{ message?: string }> {
  const { tenant, can } = await requireTenant(slug);
  if (!can("money")) return { message: "Your access level doesn't include payment links." };
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { message: "That link wasn't found." };

  const result = await deactivatePaymentLink(tenant.id, id);
  if (!result.ok) return { message: result.message };
  refresh();
  return {};
}
