import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Google tokens are stored sealed (AES-256-GCM), so a copy of the database
// alone doesn't give anyone access to a business's calendar. The key comes
// from CALENDAR_TOKEN_SECRET (any long random string); changing it means
// every business has to connect Google again.

const VERSION = "v1";

function keyOf(secret: string) {
  return createHash("sha256").update(secret).digest();
}

export function tokenSecret() {
  const secret = process.env.CALENDAR_TOKEN_SECRET;
  if (!secret) throw new Error("CALENDAR_TOKEN_SECRET must be set to connect Google Calendar.");
  return secret;
}

export function seal(plain: string, secret = tokenSecret()) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyOf(secret), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
}

// Null when it was sealed with another key or has been tampered with.
export function unseal(sealed: string, secret = tokenSecret()): string | null {
  const [version, iv, tag, body] = sealed.split(".");
  if (version !== VERSION || !iv || !tag || body === undefined) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", keyOf(secret), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
