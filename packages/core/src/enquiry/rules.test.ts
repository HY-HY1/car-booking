import { describe, expect, it } from "vitest";
import { enquiryAnswers, enquirySchema } from "./rules";

const base = { name: "Sarah Jones", email: " Sarah@Example.com ", message: "Could you quote for paint correction on a 2019 Golf?" };

describe("enquiry form", () => {
  it("tidies what was typed, with phone and postcode optional", () => {
    const e = enquirySchema.parse({ ...base, phone: "07700 900123", postcode: "gl50 1aa", topic: "Paint correction", vehicle: "VW Golf" });
    expect([e.email, e.phone, e.postcode]).toEqual(["sarah@example.com", "+447700900123", "GL50 1AA"]);
    const bare = enquirySchema.parse(base);
    expect([bare.phone, bare.postcode]).toEqual([null, null]);
  });

  it("refuses a bad phone or postcode, a too-short message, or one full of links", () => {
    expect(enquirySchema.safeParse({ ...base, phone: "call me" }).success).toBe(false);
    expect(enquirySchema.safeParse({ ...base, postcode: "GL50" }).success).toBe(false);
    expect(enquirySchema.safeParse({ ...base, message: "hi" }).success).toBe(false);
    expect(enquirySchema.safeParse({ ...base, message: "see http://a.com http://b.com www.c.com" }).success).toBe(false);
    expect(enquirySchema.safeParse({ ...base, name: "www.spam.com" }).success).toBe(false);
  });

  it("keeps the answers the owner reads, leaving out blanks", () => {
    const e = enquirySchema.parse({ ...base, topic: "Something else", message: "First line.\r\n\r\n\r\n\r\nSecond, please." });
    expect(enquiryAnswers(e)).toEqual([
      { question: "About", answer: "Something else" },
      { question: "Message", answer: "First line.\n\nSecond, please." },
    ]);
  });
});
