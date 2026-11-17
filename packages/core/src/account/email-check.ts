import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { PRODUCT_NAME } from "../brand";
import { confirmEmail, fromHeader, renderEmail } from "../email/compose";
import { deliver, fromAddress } from "../email/transport";
import { createAdminClient } from "../supabase/admin";
import { appUrl } from "../urls";

// Checking a new owner owns the email they signed up with, so nobody can open
// an account in someone else's name. Sign-up carries on to the card form
// straight away; the dashboard stays locked (lib/auth.ts requireTenant) until
// they press the link we email them.
//
// The link carries a random token. Only its hash is kept, in the account's
// app_metadata (which only the server can write), and pressing the link
// clears it. Accounts made before this, or by the super-admin or a team
// invite, never have one, so they're treated as checked.
const FLAG = "email_check";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

// For admin.createUser at sign-up: the account starts unchecked.
export function newEmailCheck() {
  const token = randomBytes(32).toString("base64url");
  return { token, appMetadata: { [FLAG]: hash(token) } };
}

// From the session's claims (quick) or a fresh read of the user.
export function emailCheckPending(appMetadata: unknown) {
  return typeof (appMetadata as Record<string, unknown> | null)?.[FLAG] === "string";
}

async function appMetadataOf(userId: string) {
  const { data, error } = await createAdminClient().auth.admin.getUserById(userId);
  if (error) throw error;
  return { email: data.user?.email ?? null, appMetadata: data.user?.app_metadata ?? {} };
}

// Read fresh, not from the session: the session only catches up when it's
// next refreshed.
export async function emailCheckDone(userId: string) {
  return !emailCheckPending((await appMetadataOf(userId)).appMetadata);
}

export async function sendEmailCheck(userId: string, email: string, token: string) {
  const url = appUrl(`/verify-email/confirm?u=${encodeURIComponent(userId)}&t=${encodeURIComponent(token)}`, { absolute: true });
  const composed = confirmEmail(url);
  const { text, html } = renderEmail({
    content: composed,
    audience: "platform",
    brand: { name: PRODUCT_NAME },
    footer: [PRODUCT_NAME, "You're getting this because this address was used to sign up."],
  });
  const sent = await deliver({
    from: fromHeader(PRODUCT_NAME, fromAddress()),
    to: email,
    subject: composed.subject,
    text,
    html,
    idempotencyKey: `email-check-${hash(token).slice(0, 32)}`,
  });
  if (!sent.ok) console.error("Couldn't send the email check", sent.error);
  return sent.ok;
}

// A new link, replacing the old one. False if there's nothing to check.
export async function resendEmailCheck(userId: string) {
  const { email, appMetadata } = await appMetadataOf(userId);
  if (!email || !emailCheckPending(appMetadata)) return false;
  const { token, appMetadata: fresh } = newEmailCheck();
  const { error } = await createAdminClient().auth.admin.updateUserById(userId, { app_metadata: fresh });
  if (error) throw error;
  return sendEmailCheck(userId, email, token);
}

// The link was pressed: true if the token is this account's current one (or
// it was already checked), and the check is cleared.
export async function confirmEmailCheck(userId: string, token: string) {
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !token) return false;
  let current: Record<string, unknown>;
  try {
    current = (await appMetadataOf(userId)).appMetadata as Record<string, unknown>;
  } catch {
    return false;
  }
  const stored = current[FLAG];
  if (typeof stored !== "string") return true;
  const given = Buffer.from(hash(token));
  if (given.length !== stored.length || !timingSafeEqual(given, Buffer.from(stored))) return false;
  const { error } = await createAdminClient().auth.admin.updateUserById(userId, { app_metadata: { [FLAG]: null } });
  if (error) throw error;
  return true;
}
