import { createHash, randomBytes } from "node:crypto";

// API keys look like "ascnd_" + 43 url-safe characters (32 random bytes).
// That's far too much randomness to guess, so a plain SHA-256 is enough to
// store them by: a slow password hash would only slow every request down.

const PREFIX = "ascnd_";
const KEY_PATTERN = /^ascnd_[A-Za-z0-9_-]{43}$/;

export function generateApiKey() {
  const key = PREFIX + randomBytes(32).toString("base64url");
  return { key, hash: hashApiKey(key), prefix: key.slice(0, PREFIX.length + 6) };
}

export function hashApiKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export function looksLikeApiKey(value: string) {
  return KEY_PATTERN.test(value);
}

// "Authorization: Bearer ascnd_…" → the key, or null.
export function keyFromAuthHeader(header: string | null) {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header ?? "");
  return match && looksLikeApiKey(match[1]) ? match[1] : null;
}
