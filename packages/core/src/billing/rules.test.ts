import { describe, expect, it } from "vitest";
import { slugSchema } from "../platform/rules";
import {
  AWAITING_CHECKOUT,
  hasAccess,
  priceLabel,
  signupSchema,
  slugCandidates,
  tenantBillingFields,
} from "./rules";

describe("hasAccess", () => {
  it("never locks out a business that isn't billed through the app", () => {
    expect(hasAccess(null)).toBe(true);
    expect(hasAccess(undefined)).toBe(true);
  });

  it("lets trials, paying and late-paying customers in", () => {
    for (const s of ["trialing", "active", "past_due"]) expect(hasAccess(s)).toBe(true);
  });

  it("keeps out anyone who hasn't started, has cancelled or has stopped paying", () => {
    for (const s of [AWAITING_CHECKOUT, "canceled", "unpaid", "incomplete", "incomplete_expired", "paused"]) {
      expect(hasAccess(s)).toBe(false);
    }
  });
});

describe("signupSchema", () => {
  const valid = {
    name: "  Sam Shine ",
    email: " Sam@Shine.example ",
    password: "correct horse",
    businessName: "Shine Mobile Valeting",
    trade: "valeting",
    locations: "both",
    postcode: "bs1 4dj",
  };

  it("cleans up what was typed", () => {
    const out = signupSchema.parse(valid);
    expect(out).toMatchObject({ name: "Sam Shine", email: "sam@shine.example", postcode: "BS1 4DJ" });
  });

  it("asks for each thing in plain words", () => {
    const issues = signupSchema.safeParse({ name: "", email: "x", password: "short", businessName: "", trade: "", locations: "", postcode: "BS1" });
    expect(issues.success).toBe(false);
    const byField = Object.fromEntries(issues.error!.issues.map((i) => [String(i.path[0]), i.message]));
    expect(byField).toMatchObject({
      name: "Enter your name.",
      email: "Enter a valid email address.",
      password: "Use at least 8 characters.",
      businessName: "Enter your business name.",
      trade: "Pick one.",
      locations: "Pick one.",
      postcode: "Enter a full UK postcode, like BS1 4DJ.",
    });
  });

  it("keeps passwords to what bcrypt reads", () => {
    expect(signupSchema.safeParse({ ...valid, password: "x".repeat(73) }).success).toBe(false);
    expect(signupSchema.safeParse({ ...valid, password: "x".repeat(72) }).success).toBe(true);
  });
});

describe("slugCandidates", () => {
  it("starts with the business name and then adds numbers", () => {
    expect(slugCandidates("Shine Mobile Valeting", 3)).toEqual(["shine-mobile-valeting", "shine-mobile-valeting-2", "shine-mobile-valeting-3"]);
  });

  it("skips reserved words and names with no letters in them", () => {
    expect(slugCandidates("Platform", 2)).toEqual(["platform-2", "platform-3"]);
    expect(slugCandidates("!!!", 2)).toEqual(["business", "business-2"]);
    expect(slugCandidates("Book", 2)).toEqual(["book-2", "book-3"]);
  });

  it("pads names too short to be a slug", () => {
    expect(slugCandidates("AB", 2)).toEqual(["ab-2", "ab-3"]);
  });

  it("stays valid when the name is as long as a slug can be", () => {
    const candidates = slugCandidates("a".repeat(80));
    expect(candidates).toHaveLength(6);
    for (const c of candidates) expect(slugSchema.safeParse(c).success).toBe(true);
    expect(new Set(candidates).size).toBe(6);
  });
});

describe("priceLabel", () => {
  it("says what they'll pay, in pounds and per period", () => {
    expect(priceLabel({ unit_amount: 4900, currency: "gbp", recurring: { interval: "month" } })).toBe("£49.00 a month");
    expect(priceLabel({ unit_amount: 49900, currency: "gbp", recurring: { interval: "year" } })).toBe("£499.00 a year");
  });

  it("copes with a one-off or a price with no amount", () => {
    expect(priceLabel({ unit_amount: 1500, currency: "gbp" })).toBe("£15.00");
    expect(priceLabel({ unit_amount: null, currency: "gbp" })).toBe("");
  });
});

describe("tenantBillingFields", () => {
  const sub = { id: "sub_1", status: "trialing", customer: "cus_1", trial_end: 1_793_000_000 };

  it("keeps the trial end while trialing", () => {
    expect(tenantBillingFields(sub)).toEqual({
      stripe_customer_id: "cus_1",
      stripe_subscription_id: "sub_1",
      subscription_status: "trialing",
      trial_ends_at: new Date(1_793_000_000 * 1000).toISOString(),
    });
  });

  it("drops it once the trial is over", () => {
    expect(tenantBillingFields({ ...sub, status: "active" }).trial_ends_at).toBeNull();
    expect(tenantBillingFields({ ...sub, status: "canceled" }).trial_ends_at).toBeNull();
  });

  it("accepts an expanded customer", () => {
    expect(tenantBillingFields({ ...sub, customer: { id: "cus_2" } }).stripe_customer_id).toBe("cus_2");
  });
});
