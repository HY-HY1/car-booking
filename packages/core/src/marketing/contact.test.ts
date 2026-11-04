import { describe, expect, it } from "vitest";
import { checkContact, contactEmail, isContactTopic, MIN_FILL_MS } from "./contact";

const now = 1_800_000_000_000;
const valid = {
  name: " Sam Driver ",
  email: "Sam@Example.com",
  business: "",
  phone: "",
  topic: "demo",
  message: "Could you show me how deposits work?",
  website: "",
  startedAt: String(now - 10_000),
};

describe("checkContact", () => {
  it("accepts a filled-in form and tidies it", () => {
    const result = checkContact(valid, now);
    expect(result).toEqual({
      ok: true,
      message: {
        name: "Sam Driver",
        email: "sam@example.com",
        business: null,
        phone: null,
        topic: "demo",
        message: "Could you show me how deposits work?",
      },
    });
  });

  it("treats a filled honeypot as a bot", () => {
    expect(checkContact({ ...valid, website: "http://spam" }, now)).toEqual({ ok: false, bot: true });
  });

  it("treats a form sent too fast, or with a junk start time, as a bot", () => {
    expect(checkContact({ ...valid, startedAt: String(now - MIN_FILL_MS + 1) }, now)).toEqual({ ok: false, bot: true });
    expect(checkContact({ ...valid, startedAt: "soon" }, now)).toEqual({ ok: false, bot: true });
  });

  it("lets a form through with no start time (no JavaScript)", () => {
    expect(checkContact({ ...valid, startedAt: "" }, now).ok).toBe(true);
  });

  it("explains each problem once, per field", () => {
    const result = checkContact({ ...valid, name: "", email: "nope", topic: "spam", message: "hi", phone: "call me" }, now);
    expect(result.ok).toBe(false);
    if (result.ok || result.bot) throw new Error("expected field errors");
    expect(Object.keys(result.errors).sort()).toEqual(["email", "message", "name", "phone", "topic"]);
    expect(result.errors.message).toBe("A few more words, so we can help.");
  });

  it("keeps an optional phone number and business", () => {
    const result = checkContact({ ...valid, phone: "+44 7700 900123", business: "Shine Co" }, now);
    expect(result.ok && result.message.phone).toBe("+44 7700 900123");
    expect(result.ok && result.message.business).toBe("Shine Co");
  });
});

describe("isContactTopic", () => {
  it("knows the topics and nothing else", () => {
    expect(isContactTopic("website")).toBe(true);
    expect(isContactTopic("toString")).toBe(false);
    expect(isContactTopic(undefined)).toBe(false);
  });
});

describe("contactEmail", () => {
  it("puts the topic and sender in the subject and the details in the body", () => {
    const email = contactEmail(
      { name: "Sam", email: "sam@example.com", business: "Shine Co", phone: null, topic: "website", message: "Hello there, a site please." },
      "Kerbside",
    );
    expect(email.subject).toBe("A website built for me: Sam (Shine Co)");
    expect(email.text).toContain("Email: sam@example.com");
    expect(email.text).not.toContain("Phone:");
    expect(email.text).toContain("Hello there, a site please.");
  });
});
