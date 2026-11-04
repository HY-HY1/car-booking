import { describe, expect, it } from "vitest";
import { seal, unseal } from "./crypto";

describe("seal", () => {
  const secret = "a-long-random-test-secret";

  it("opens with the same secret, and never looks like the token", () => {
    const sealed = seal("1//refresh-token", secret);
    expect(sealed).not.toContain("refresh-token");
    expect(sealed.startsWith("v1.")).toBe(true);
    expect(unseal(sealed, secret)).toBe("1//refresh-token");
    // A fresh IV each time.
    expect(seal("1//refresh-token", secret)).not.toBe(sealed);
  });

  it("won't open with another secret, tampered or malformed", () => {
    const sealed = seal("token", secret);
    expect(unseal(sealed, "another-secret")).toBeNull();
    const [v, iv, tag, body] = sealed.split(".");
    const bytes = Buffer.from(body, "base64url");
    bytes[0] ^= 1;
    expect(unseal([v, iv, tag, bytes.toString("base64url")].join("."), secret)).toBeNull();
    expect(unseal("plain-token", secret)).toBeNull();
    expect(unseal("v2.a.b.c", secret)).toBeNull();
  });
});
