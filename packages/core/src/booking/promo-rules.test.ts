import { describe, expect, it } from "vitest";
import { applyPromo, discountPence, normaliseCode, promoFormSchema, promoProblem, type Promo } from "./promo-rules";
import type { Quote } from "./pricing";

const quote = { lines: [{ label: "Full valet", amount_pence: 10000 }], total_pence: 10000, deposit_pence: 2000 } as Quote;
const tenPercent: Promo = { id: "a", code: "TEN", kind: "percent", value: 10 };
const now = new Date("2026-11-10T12:00:00Z");

describe("discountPence", () => {
  it("takes a percentage off", () => {
    expect(discountPence(10000, { kind: "percent", value: 15 })).toBe(1500);
  });

  it("takes a fixed amount off, but never more than the price", () => {
    expect(discountPence(10000, { kind: "fixed", value: 500 })).toBe(500);
    expect(discountPence(300, { kind: "fixed", value: 500 })).toBe(300);
  });
});

describe("applyPromo", () => {
  it("adds a line that keeps the total adding up, and reworks a percentage deposit", () => {
    const result = applyPromo(quote, tenPercent, { type: "percent", value: 20 });
    expect(result.total_pence).toBe(9000);
    expect(result.deposit_pence).toBe(1800);
    expect(result.lines.reduce((sum, l) => sum + l.amount_pence, 0)).toBe(9000);
  });

  it("caps a fixed deposit at the new total", () => {
    const result = applyPromo(quote, { ...tenPercent, kind: "fixed", value: 9500 }, { type: "fixed", value_pence: 2000 });
    expect(result.total_pence).toBe(500);
    expect(result.deposit_pence).toBe(500);
  });
});

describe("promoProblem", () => {
  const row = { active: true, expires_at: null, max_uses: null };

  it("accepts a live code", () => {
    expect(promoProblem(row, 99, now)).toBeNull();
  });

  it("refuses one switched off, expired or used up", () => {
    expect(promoProblem({ ...row, active: false }, 0, now)).toMatch(/active/);
    expect(promoProblem({ ...row, expires_at: "2026-11-09T23:59:59Z" }, 0, now)).toMatch(/expired/);
    expect(promoProblem({ ...row, max_uses: 3 }, 3, now)).toMatch(/used up/);
  });
});

describe("promoFormSchema", () => {
  const base = { code: " spring-10 ", kind: "percent", amount: "10", max_uses: "", expires_on: "" };

  it("cleans the code up and stores a percentage as it is", () => {
    expect(promoFormSchema.parse(base)).toMatchObject({ code: "SPRING-10", value: 10, max_uses: null, expires_at: null });
  });

  it("stores a fixed amount in pence", () => {
    expect(promoFormSchema.parse({ ...base, kind: "fixed", amount: "£12.50" }).value).toBe(1250);
  });

  it("refuses a percentage over 100", () => {
    expect(promoFormSchema.safeParse({ ...base, amount: "101" }).success).toBe(false);
  });
});

describe("normaliseCode", () => {
  it("ignores case and stray spaces", () => {
    expect(normaliseCode(" ten ")).toBe("TEN");
  });
});
