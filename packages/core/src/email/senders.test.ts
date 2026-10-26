import { describe, expect, it } from "vitest";
import { domainOfAddress, senderAddressSchema, senderRecords, senderStatusOf } from "./senders";

describe("senderAddressSchema", () => {
  const schema = senderAddressSchema("bookings.example");

  it("takes an address on the business's own domain, tidied", () => {
    expect(schema.parse("  Harvey@ASCNDdetailing.co.uk ")).toBe("harvey@ascnddetailing.co.uk");
    expect(domainOfAddress("hello@mail.shine.co.uk")).toBe("mail.shine.co.uk");
  });

  it("refuses free mail, our own domains and things that aren't addresses", () => {
    for (const bad of ["me@gmail.com", "me@icloud.com", "x@bookings.example", "x@shine.bookings.example", "x@car-booking.vercel.app", "nope"]) {
      expect(schema.safeParse(bad).success, bad).toBe(false);
    }
  });
});

describe("senderRecords", () => {
  it("gives each record's host without the domain, and the full name", () => {
    const records = senderRecords("shine.co.uk", [
      { record: "DKIM", name: "resend._domainkey", type: "TXT", value: "p=MIGf" },
      { record: "SPF", name: "send", type: "MX", value: "feedback-smtp.eu-west-1.amazonses.com", priority: 10 },
      { record: "SPF", name: "send.shine.co.uk", type: "TXT", value: "v=spf1 include:amazonses.com ~all" },
      { record: "DMARC", name: "@", type: "TXT", value: "v=DMARC1; p=none;" },
      { name: 3 },
    ]);
    expect(records).toEqual([
      { type: "TXT", host: "resend._domainkey", fullName: "resend._domainkey.shine.co.uk", value: "p=MIGf" },
      { type: "MX", host: "send", fullName: "send.shine.co.uk", value: "feedback-smtp.eu-west-1.amazonses.com", priority: 10 },
      { type: "TXT", host: "send", fullName: "send.shine.co.uk", value: "v=spf1 include:amazonses.com ~all" },
      { type: "TXT", host: "@", fullName: "shine.co.uk", value: "v=DMARC1; p=none;" },
    ]);
    expect(senderRecords("shine.co.uk", null)).toEqual([]);
  });
});

describe("senderStatusOf", () => {
  it("treats anything short of verified or failed as still waiting", () => {
    expect(senderStatusOf("verified")).toBe("verified");
    expect(senderStatusOf("failed")).toBe("failed");
    for (const s of ["not_started", "pending", "temporary_failure"]) expect(senderStatusOf(s)).toBe("pending");
  });
});
