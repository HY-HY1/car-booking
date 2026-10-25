import { z } from "zod";

// Pure rules for UK GDPR handling: what a data request looks like, when it's
// due, and the signed links used to unsubscribe. Nothing here touches the
// database, so it's all unit-tested.

export const REQUEST_KINDS = {
  access: "Get a copy of my data",
  erasure: "Delete my data",
  correction: "Correct my data",
  objection: "Stop using my data / stop marketing",
  other: "Something else",
} as const;
export type RequestKind = keyof typeof REQUEST_KINDS;

export const REQUEST_STATUSES = {
  open: "Open",
  in_progress: "In progress",
  completed: "Completed",
  refused: "Refused",
} as const;
export type RequestStatus = keyof typeof REQUEST_STATUSES;

// What the public privacy-request form sends. `website` is a honeypot: real
// people never see the field, so anything in it is a bot.
export const publicRequestSchema = z.object({
  kind: z.enum(Object.keys(REQUEST_KINDS) as [RequestKind, ...RequestKind[]], "Pick what you need."),
  name: z.string().trim().min(1, "Enter your name.").max(100),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  details: z.string().trim().max(2000, "Keep it under 2,000 characters.").optional(),
  website: z.string().max(0).optional(),
});
export type PublicRequest = z.output<typeof publicRequestSchema>;

// Whole days until a request is due. Negative once it's overdue.
export function daysUntilDue(dueAt: string | Date, now = new Date()) {
  const ms = new Date(dueAt).getTime() - now.getTime();
  return Math.ceil(ms / 86_400_000);
}

export function isOpen(status: string) {
  return status === "open" || status === "in_progress";
}

// The ICO number is "ZA" or "Z" followed by digits (e.g. ZA123456).
export const icoNumberSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^Z[A-Z]?\d{6,8}$/, "Enter it like ZA123456.");

export const privacySettingsSchema = z.object({
  legalName: z.string().trim().max(150).optional(),
  privacyEmail: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")).optional().or(z.literal("")),
  icoRegistration: z.union([icoNumberSchema, z.literal("")]).optional(),
  retentionMonths: z.coerce.number().int().min(12, "At least 12 months.").max(84, "No more than 84 months (7 years)."),
});

// ---------------------------------------------------------------------------
// Unsubscribe links. A signed token carries the customer and channel, so the
// link in a marketing message works with one click and can't be guessed or
// pointed at someone else.
// ---------------------------------------------------------------------------

export type MarketingChannel = "email" | "sms" | "whatsapp";

async function hmac(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Buffer.from(sig).toString("base64url");
}

export async function signUnsubscribeToken(secret: string, customerId: string, channel: MarketingChannel) {
  const payload = `${customerId}.${channel}`;
  return `${payload}.${await hmac(secret, payload)}`;
}

export async function verifyUnsubscribeToken(
  secret: string,
  token: string,
): Promise<{ customerId: string; channel: MarketingChannel } | null> {
  const [customerId, channel, sig, ...rest] = token.split(".");
  if (rest.length || !customerId || !channel || !sig) return null;
  if (!/^[0-9a-f-]{36}$/i.test(customerId)) return null;
  if (channel !== "email" && channel !== "sms" && channel !== "whatsapp") return null;
  const expected = await hmac(secret, `${customerId}.${channel}`);
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0 ? { customerId, channel } : null;
}
