import { createHmac, timingSafeEqual } from "node:crypto";

// Resend's webhooks (resend.com → Webhooks), checked and read. Resend signs
// them the Svix way: an HMAC-SHA256 of "<id>.<timestamp>.<body>" with the
// endpoint's signing secret ("whsec_" + base64), sent as one or more
// "v1,<base64>" signatures. Pure: no database (events.ts does that).

// Older than this and a signed request is refused, so a captured one can't
// be replayed later.
const TOLERANCE_SECONDS = 5 * 60;

export function verifyResendSignature(
  secret: string,
  raw: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  now = Date.now(),
) {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return false;
  const sent = Number(timestamp);
  if (!Number.isFinite(sent) || Math.abs(now / 1000 - sent) > TOLERANCE_SECONDS) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${raw}`).digest();
  return signature.split(" ").some((part) => {
    const [version, value] = part.split(",");
    if (version !== "v1" || !value) return false;
    const given = Buffer.from(value, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

// What we act on. A permanent bounce means the address doesn't exist; a
// transient one (full mailbox, server down) is only noted.
export type ResendEvent =
  | { kind: "bounced"; emailId: string; to: string | null; permanent: boolean; reason: string }
  | { kind: "complained"; emailId: string; to: string | null };

export function parseResendEvent(body: unknown): ResendEvent | null {
  if (!body || typeof body !== "object") return null;
  const { type, data } = body as { type?: unknown; data?: Record<string, unknown> };
  if (!data || typeof data.email_id !== "string") return null;
  const to = Array.isArray(data.to) && typeof data.to[0] === "string" ? data.to[0] : typeof data.to === "string" ? data.to : null;
  if (type === "email.bounced") {
    const bounce = (data.bounce ?? {}) as { type?: unknown; subType?: unknown; message?: unknown };
    const reason = [bounce.type, bounce.subType, bounce.message].filter((v) => typeof v === "string" && v).join(": ");
    return { kind: "bounced", emailId: data.email_id, to, permanent: bounce.type !== "Transient", reason: reason || "Bounced" };
  }
  if (type === "email.complained") return { kind: "complained", emailId: data.email_id, to };
  return null;
}
