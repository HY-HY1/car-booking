import { z } from "zod";
import { CONTACT_TOPICS, type ContactTopic } from "./contact-topics";

export { CONTACT_TOPICS, isContactTopic, type ContactTopic } from "./contact-topics";

// The marketing site's contact form: what it accepts, and the email it turns
// into. Pure, so the rules are tested without sending anything.

// Anything quicker than this from the form appearing is a bot.
export const MIN_FILL_MS = 3000;

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .transform((v) => v || null);

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Tell us your name.").max(100, "Keep this under 100 characters."),
  email: z.string().trim().toLowerCase().pipe(z.email("That doesn't look like an email address.")),
  business: optional(120),
  phone: optional(30).refine((v) => v === null || /^[0-9 +()-]{7,30}$/.test(v), "That doesn't look like a phone number."),
  topic: z.enum(Object.keys(CONTACT_TOPICS) as [ContactTopic, ...ContactTopic[]], "Choose what it's about."),
  message: z
    .string()
    .trim()
    .min(10, "A few more words, so we can help.")
    .max(4000, "Keep this under 4,000 characters."),
});

export type ContactMessage = z.infer<typeof contactSchema>;

export type ContactCheck =
  | { ok: true; message: ContactMessage }
  | { ok: false; bot: true }
  | { ok: false; bot: false; errors: Partial<Record<keyof ContactMessage, string>> };

// `website` is the hidden honeypot field; `startedAt` is when the form was
// shown, in ms, set by the browser (blank without JavaScript, which is let
// through). Bots are told it worked and nothing is sent.
export function checkContact(fields: Record<string, unknown>, now: number): ContactCheck {
  if (typeof fields.website === "string" && fields.website.trim()) return { ok: false, bot: true };
  const startedAt = typeof fields.startedAt === "string" && fields.startedAt ? Number(fields.startedAt) : null;
  if (startedAt !== null && (!Number.isFinite(startedAt) || now - startedAt < MIN_FILL_MS)) return { ok: false, bot: true };

  const parsed = contactSchema.safeParse(fields);
  if (parsed.success) return { ok: true, message: parsed.data };

  const errors: Partial<Record<keyof ContactMessage, string>> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0] as keyof ContactMessage;
    errors[key] ??= issue.message;
  }
  return { ok: false, bot: false, errors };
}

// The email the team gets. Replies go straight back to the sender.
export function contactEmail(m: ContactMessage, productName: string) {
  const topic = CONTACT_TOPICS[m.topic];
  const lines = [
    `${m.name}${m.business ? `, ${m.business}` : ""} sent a message from the ${productName} website.`,
    "",
    `About: ${topic}`,
    `Email: ${m.email}`,
    ...(m.phone ? [`Phone: ${m.phone}`] : []),
    "",
    m.message,
    "",
    "Reply to this email to answer them.",
  ];
  return {
    subject: `${topic}: ${m.name}${m.business ? ` (${m.business})` : ""}`.slice(0, 150),
    text: lines.join("\n"),
  };
}
