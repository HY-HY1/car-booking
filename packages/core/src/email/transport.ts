import "server-only";

// Hands a finished email to Resend (resend.com) over its HTTP API. Without
// RESEND_API_KEY, development prints the email to the console instead, so the
// whole flow can be followed locally; production treats a missing key as a
// failed send, which the email log records.

export type OutgoingEmail = {
  from: string;
  to: string;
  replyTo?: string | null;
  subject: string;
  text: string;
  html: string;
  headers?: Record<string, string>;
  // Resend drops a repeat with the same key for 24 hours.
  idempotencyKey: string;
};

export type SendResult = { ok: true; providerId: string } | { ok: false; error: string };

export function fromAddress() {
  return process.env.EMAIL_FROM_ADDRESS || "onboarding@resend.dev";
}

export async function deliver(email: OutgoingEmail): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") return { ok: false, error: "Email isn't set up: RESEND_API_KEY is missing." };
    console.info(
      `[email] (not sent: no RESEND_API_KEY)\nFrom: ${email.from}\nTo: ${email.to}\nReply-To: ${email.replyTo ?? "-"}\nSubject: ${email.subject}\n\n${email.text}`,
    );
    return { ok: true, providerId: "console" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": email.idempotencyKey,
      },
      body: JSON.stringify({
        from: email.from,
        to: [email.to],
        ...(email.replyTo && { reply_to: email.replyTo }),
        subject: email.subject,
        text: email.text,
        html: email.html,
        ...(email.headers && { headers: email.headers }),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await response.json().catch(() => null)) as { id?: string; message?: string } | null;
    if (!response.ok || !json?.id) {
      return { ok: false, error: `Resend ${response.status}: ${json?.message ?? "no message id"}`.slice(0, 500) };
    }
    return { ok: true, providerId: json.id };
  } catch (error) {
    return { ok: false, error: `Resend unreachable: ${error instanceof Error ? error.message : String(error)}`.slice(0, 500) };
  }
}
