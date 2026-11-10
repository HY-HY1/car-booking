import { timingSafeEqual } from "node:crypto";
import { handleLeadgen } from "@leadgen/core/meta/leads";
import { leadgenChanges, verifyMetaSignature } from "@leadgen/core/meta/rules";

// /api/webhooks/meta: Meta's Webhooks product, subscribed to Page → leadgen
// in the Meta app dashboard with this address and META_WEBHOOK_VERIFY_TOKEN.

// Meta checks the address once, when it's saved in the app dashboard.
export function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;
  const given = q.get("hub.verify_token") ?? "";
  const ok =
    expected &&
    q.get("hub.mode") === "subscribe" &&
    given.length === expected.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return new Response("Forbidden", { status: 403 });
  return new Response(q.get("hub.challenge") ?? "", { headers: { "Content-Type": "text/plain" } });
}

// A new lead. Signed with the app secret; anything else is refused. An error
// makes Meta send it again later, and a lead is only ever added once.
export async function POST(request: Request) {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return new Response("Not configured", { status: 404 });
  const raw = await request.text();
  if (!verifyMetaSignature(secret, raw, request.headers.get("x-hub-signature-256"))) {
    return new Response("Bad signature", { status: 401 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  try {
    await handleLeadgen(leadgenChanges(body));
  } catch {
    return new Response("Try again", { status: 500 });
  }
  return new Response("OK");
}
