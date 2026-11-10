import "server-only";
import { createHash } from "node:crypto";
import { passwordReset, renderEmail } from "../email/compose";
import { deliver, fromAddress } from "../email/transport";
import { createAdminClient } from "../supabase/admin";
import { appUrl } from "../urls";
import { resetAllowed } from "./rules";

// Emails a link for choosing a new password, from our own sender rather than
// Supabase's. The link carries a one-time token that works in any browser and
// is only spent when the person presses a button, so a mail scanner opening it
// can't use it up. Nothing tells the caller whether the address has an account.
export async function sendPasswordReset(email: string) {
  const db = createAdminClient();
  const emailHash = createHash("sha256").update(email).digest("hex");

  // If this can't be read the email still goes: a person locked out matters
  // more than an extra email.
  const recent = await db.from("password_reset_requests").select("sent_at").eq("email_hash", emailHash).maybeSingle();
  if (recent.error) console.error("Couldn't read password reset requests", recent.error);
  else if (!resetAllowed(recent.data?.sent_at, new Date())) return;

  const { data, error } = await db.auth.admin.generateLink({ type: "recovery", email });
  if (error) {
    if (error.code !== "user_not_found") console.error("Couldn't create a password reset link", error);
    return;
  }

  const saved = await db.from("password_reset_requests").upsert({ email_hash: emailHash, sent_at: new Date().toISOString() });
  if (saved.error) console.error("Couldn't record a password reset request", saved.error);

  const token = data.properties.hashed_token;
  const composed = passwordReset(appUrl(`/reset-password?token=${encodeURIComponent(token)}`, { absolute: true }));
  const { text, html } = renderEmail({
    heading: composed.subject,
    body: composed.body,
    button: composed.button,
    footer: ["You're getting this because someone asked to reset the password for this account."],
  });
  const sent = await deliver({ from: fromAddress(), to: email, subject: composed.subject, text, html, idempotencyKey: `password-reset-${token}` });
  if (!sent.ok) console.error("Couldn't send a password reset email", sent.error);
}
