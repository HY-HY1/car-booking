import { createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

// Webhooks: a business's own system is told when bookings and leads change.
// Pure rules (no database), so they can be tested and shown in the docs.
//
// Each request is a POST of JSON with these headers:
//   Webhook-Id         the event's id; the same on a retry, so it can be deduplicated
//   Webhook-Timestamp  seconds since 1970 when this attempt was signed
//   Webhook-Signature  v1,<base64 HMAC-SHA256 of "<id>.<timestamp>.<body>">
// (the Standard Webhooks layout, so off-the-shelf libraries can check it).

import type { WebhookEvent } from "./events";

export { WEBHOOK_EVENTS, WEBHOOK_EVENT_KEYS, isWebhookEvent, type WebhookEvent } from "./events";

// Statuses that mean a real booking. A held slot is a checkout in progress,
// and an expired one never became a booking.
const LIVE = new Set(["requested", "confirmed", "completed", "no_show", "cancelled"]);

export type BookingState = { status: string; startsAt: string };

const SETTLED: Record<string, WebhookEvent> = {
  cancelled: "booking.cancelled",
  completed: "booking.completed",
  no_show: "booking.no_show",
};

// What happened to a booking since webhooks last heard about it. Null when
// there's nothing to tell (a hold, or a checkout that never finished).
// `createdRecently`: with nothing heard before, a booking made in the last
// hour is new; an older one was made before webhooks were set up, so it's
// named by where it is now.
export function bookingEventFor(
  before: BookingState | null,
  now: BookingState,
  opts: { createdRecently: boolean },
): WebhookEvent | null {
  if (!LIVE.has(now.status)) return null;
  if (!before && !opts.createdRecently) return SETTLED[now.status] ?? "booking.updated";
  if (!before || !LIVE.has(before.status)) return now.status === "cancelled" ? null : "booking.created";
  if (before.status !== now.status) {
    if (SETTLED[now.status]) return SETTLED[now.status];
    if (before.status === "requested" && now.status === "confirmed") return "booking.confirmed";
    // Put back (completed → confirmed, say): it changed, nothing more specific.
    return "booking.updated";
  }
  if (new Date(before.startsAt).getTime() !== new Date(now.startsAt).getTime()) return "booking.rescheduled";
  return "booking.updated";
}

// ------------------------------------------------------------------ signing

export function newSigningSecret(bytes: Buffer) {
  return `whsec_${bytes.toString("base64")}`;
}

function keyOf(secret: string) {
  return Buffer.from(secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret, "base64");
}

export function sign(secret: string, id: string, timestamp: number, body: string) {
  return `v1,${createHmac("sha256", keyOf(secret)).update(`${id}.${timestamp}.${body}`).digest("base64")}`;
}

// For the docs and tests: how a receiver checks a request. Several
// signatures may be sent, separated by spaces (while a secret is rolled).
export function verify(secret: string, id: string, timestamp: number, body: string, header: string) {
  const expected = Buffer.from(sign(secret, id, timestamp, body));
  return header.split(" ").some((candidate) => {
    const got = Buffer.from(candidate);
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

// ------------------------------------------------------------------ retries

// After the first try: 1 min, 5 min, 30 min, 2 h, 6 h, 24 h, then given up.
const BACKOFF_MINUTES = [1, 5, 30, 120, 360, 1440];
export const MAX_ATTEMPTS = BACKOFF_MINUTES.length + 1;

export function nextAttemptAt(attempts: number, now: Date): Date | null {
  const wait = BACKOFF_MINUTES[attempts - 1];
  return wait === undefined ? null : new Date(now.getTime() + wait * 60_000);
}

// 2xx is delivered. Anything else, or no answer, is tried again.
export function delivered(status: number | null) {
  return status !== null && status >= 200 && status < 300;
}

// ------------------------------------------------------------------ addresses

// Addresses a webhook must never be sent to: this server, its network, or
// cloud metadata services. Checked on the hostname when saved and on every
// resolved address when sent.
export function isPrivateAddress(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (kind === 6) {
    const v = ip.toLowerCase();
    if (v === "::" || v === "::1") return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v);
  }
  return false;
}

// Why a URL can't be used, or null if it can. `allowLocal` lets a developer
// point it at their own machine (never in production).
export function webhookUrlProblem(input: string, opts: { allowLocal: boolean }): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return "Enter the full address, starting https://";
  }
  if (url.username || url.password) return "Leave the username and password out of the address.";
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const local = host === "localhost" || host.endsWith(".localhost") || (isIP(host) !== 0 && isPrivateAddress(host));
  if (local) return opts.allowLocal ? null : "That address is on a private network. Use a public https address.";
  if (url.protocol !== "https:") return "Use an https:// address, so what's sent is encrypted.";
  if (host.endsWith(".local") || host.endsWith(".internal") || !host.includes(".")) {
    return "That address isn't reachable from the internet.";
  }
  return null;
}
