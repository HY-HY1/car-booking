"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { createPaymentLink, deactivatePaymentLink, paymentLinkSchema, type CreatedPaymentLink } from "@leadgen/core/stripe/payment-links";
import { emailPaymentLink } from "@leadgen/core/email/notify";
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

export type EmailLinkState = { error?: string; sentTo?: string };

// Emails a payment link to the address typed in. Each press sends it again.
export async function emailLinkAction(slug: string, id: string, _prev: EmailLinkState, formData: FormData): Promise<EmailLinkState> {
  const { tenant, can } = await requireTenant(slug);
  if (!can("money")) return { error: "Your access level doesn't include payment links." };
  if (!z.uuid().safeParse(id).success) return { error: "That link wasn't found." };
  const to = z.email().safeParse(String(formData.get("to") ?? "").trim());
  if (!to.success) return { error: "Enter the customer's email address." };

  const result = await emailPaymentLink(tenant.id, id, to.data);
  if (!result.ok) return { error: result.message };
  refresh();
  return { sentTo: to.data };
}
