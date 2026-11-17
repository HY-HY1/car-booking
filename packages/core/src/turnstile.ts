// Cloudflare Turnstile: the check that a form was sent by a person, not a
// script. Used on the public booking page and on sign-up. Only switched on
// when TURNSTILE_SECRET_KEY (and NEXT_PUBLIC_TURNSTILE_SITE_KEY, for the
// widget) are set, so local runs and tests work without it.

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function humanCheckOn() {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

// True if the token is a fresh pass from the widget. Tokens work once and
// last five minutes. If Cloudflare can't be reached the form goes through:
// the rate limits still apply, and a Cloudflare outage shouldn't stop
// bookings.
export async function isHuman(token: unknown, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (typeof token !== "string" || !token || token.length > 2048) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip && ip !== "unknown") body.set("remoteip", ip);
  try {
    const res = await fetch(VERIFY_URL, { method: "POST", body, signal: AbortSignal.timeout(5000) });
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (!data.success) console.warn("[turnstile] refused", data["error-codes"]);
    return data.success === true;
  } catch (error) {
    console.error("[turnstile] couldn't verify, letting it through", error);
    return true;
  }
}

export const NOT_HUMAN = "We couldn't check this was sent by a person. Reload the page and try again.";
