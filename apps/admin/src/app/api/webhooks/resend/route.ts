import { handleResendEvent } from "@leadgen/core/email/events";
import { parseResendEvent, verifyResendSignature } from "@leadgen/core/email/webhook-rules";

// /api/webhooks/resend: Resend's webhook, added in the Resend dashboard
// (Webhooks → Add endpoint) for email.bounced and email.complained, with its
// signing secret in RESEND_WEBHOOK_SECRET. Anything unsigned is refused. An
// error makes Resend send it again later, and handling it twice is harmless.
export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return new Response("Not configured", { status: 404 });
  const raw = await request.text();
  const signed = verifyResendSignature(secret, raw, {
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
  });
  if (!signed) return new Response("Bad signature", { status: 401 });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const event = parseResendEvent(body);
  if (!event) return new Response("OK");
  try {
    await handleResendEvent(event);
  } catch (error) {
    console.error("[email] handling a Resend webhook failed", error);
    return new Response("Try again", { status: 500 });
  }
  return new Response("OK");
}
