// Signed links in customer emails (unsubscribe, manage booking): an HMAC of
// what the link points at, so it works without logging in and can't be
// guessed or pointed at something else.

export async function hmac(secret: string, payload: string) {
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

// Compares in constant time, so a wrong signature can't be found a character at a time.
export async function verifyHmac(secret: string, payload: string, sig: string) {
  const expected = await hmac(secret, payload);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}
