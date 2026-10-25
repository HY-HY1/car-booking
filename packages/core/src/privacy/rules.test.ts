import { describe, expect, it } from "vitest";
import {
  daysUntilDue,
  privacySettingsSchema,
  publicRequestSchema,
  signUnsubscribeToken,
  verifyUnsubscribeToken,
} from "./rules";

const id = "3f2b8c1e-4d5a-4e6f-8a7b-9c0d1e2f3a4b";

describe("daysUntilDue", () => {
  const now = new Date("2026-10-01T12:00:00Z");
  it("counts whole days, rounding up, and goes negative when overdue", () => {
    expect(daysUntilDue("2026-10-31T12:00:00Z", now)).toBe(30);
    expect(daysUntilDue("2026-10-01T18:00:00Z", now)).toBe(1);
    expect(daysUntilDue("2026-09-28T12:00:00Z", now)).toBe(-3);
  });
});

describe("publicRequestSchema", () => {
  it("accepts a normal request and lower-cases the email", () => {
    const r = publicRequestSchema.parse({ kind: "access", name: " Sam ", email: "Sam@Example.com" });
    expect(r).toMatchObject({ name: "Sam", email: "sam@example.com" });
  });
  it("rejects a filled honeypot", () => {
    expect(publicRequestSchema.safeParse({ kind: "erasure", name: "x", email: "a@b.co", website: "spam" }).success).toBe(false);
  });
  it("rejects an unknown kind", () => {
    expect(publicRequestSchema.safeParse({ kind: "sell", name: "x", email: "a@b.co" }).success).toBe(false);
  });
});

describe("privacySettingsSchema", () => {
  it("keeps retention between 12 and 84 months", () => {
    expect(privacySettingsSchema.safeParse({ retentionMonths: "36" }).success).toBe(true);
    expect(privacySettingsSchema.safeParse({ retentionMonths: "6" }).success).toBe(false);
    expect(privacySettingsSchema.safeParse({ retentionMonths: "120" }).success).toBe(false);
  });
  it("checks the ICO number shape but lets it be blank", () => {
    expect(privacySettingsSchema.safeParse({ retentionMonths: 36, icoRegistration: "za123456" }).success).toBe(true);
    expect(privacySettingsSchema.safeParse({ retentionMonths: 36, icoRegistration: "" }).success).toBe(true);
    expect(privacySettingsSchema.safeParse({ retentionMonths: 36, icoRegistration: "nope" }).success).toBe(false);
  });
});

describe("unsubscribe tokens", () => {
  it("round-trips", async () => {
    const t = await signUnsubscribeToken("s3cret", id, "email");
    expect(await verifyUnsubscribeToken("s3cret", t)).toEqual({ customerId: id, channel: "email" });
  });
  it("rejects a different secret, a swapped channel or a mangled token", async () => {
    const t = await signUnsubscribeToken("s3cret", id, "email");
    expect(await verifyUnsubscribeToken("other", t)).toBeNull();
    expect(await verifyUnsubscribeToken("s3cret", t.replace(".email.", ".sms."))).toBeNull();
    expect(await verifyUnsubscribeToken("s3cret", "garbage")).toBeNull();
    expect(await verifyUnsubscribeToken("s3cret", `${t}.x`)).toBeNull();
  });
});
