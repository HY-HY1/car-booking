"use server";

import { createHash } from "node:crypto";
import { fromHeader, renderEmail } from "@leadgen/core/email/compose";
import { deliver, fromAddress } from "@leadgen/core/email/transport";
import { checkContact, contactEmail, type ContactMessage } from "@leadgen/core/marketing/contact";
import { PRODUCT_NAME } from "@/lib/brand";

export type ContactState = {
  sent?: { name: string; email: string };
  error?: string;
  errors?: Partial<Record<keyof ContactMessage, string>>;
  values?: Record<string, string>;
};

const FIELDS = ["name", "email", "business", "phone", "topic", "message"] as const;

// Sends the website's contact form to the team, with replies going straight
// back to the sender. The inbox is server config (CONTACT_EMAIL, falling back
// to PLATFORM_ALERT_EMAIL), so no address appears on the public site. Nothing
// is stored.
export async function sendContact(_prev: ContactState, formData: FormData): Promise<ContactState> {
  const fields = Object.fromEntries([...FIELDS, "website", "startedAt"].map((k) => [k, String(formData.get(k) ?? "")]));
  const values = Object.fromEntries(FIELDS.map((k) => [k, fields[k]]));

  const check = checkContact(fields, Date.now());
  if (!check.ok) {
    // Bots get the same thank-you as people, so there's nothing to learn.
    if (check.bot) return { sent: { name: values.name || "there", email: values.email } };
    return { errors: check.errors, values };
  }

  const m = check.message;
  const to = process.env.CONTACT_EMAIL || process.env.PLATFORM_ALERT_EMAIL;
  if (!to) {
    console.error("[contact] no CONTACT_EMAIL or PLATFORM_ALERT_EMAIL set; message not sent");
    return { error: "Sorry, the form isn't working right now. Please try again later.", values };
  }

  const { subject, text: body } = contactEmail(m, PRODUCT_NAME);
  const { text, html } = renderEmail({ heading: subject, body, footer: [`Sent from the ${PRODUCT_NAME} website contact form`] });
  const result = await deliver({
    from: fromHeader(`${PRODUCT_NAME} website`, fromAddress()),
    to,
    replyTo: m.email,
    subject: `[${PRODUCT_NAME}] ${subject}`,
    text,
    html,
    // A double-click or resubmit of the same message sends it once.
    idempotencyKey: `contact:${createHash("sha256").update(`${m.email}\n${m.message}`).digest("hex")}`,
  });
  if (!result.ok) {
    console.error(`[contact] send failed: ${result.error}`);
    return { error: "Sorry, that didn't send. Please try again in a minute.", values };
  }
  return { sent: { name: m.name.split(" ")[0], email: m.email } };
}
