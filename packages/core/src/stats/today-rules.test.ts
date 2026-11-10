import { describe, expect, it } from "vitest";
import { balancesDue } from "./today-rules";

const job = (id: string, over: Partial<Parameters<typeof balancesDue>[0][number]> = {}) => ({
  id,
  ends_at: "2026-11-09T12:00:00Z",
  price_pence: 10000,
  deposit_pence: 2000,
  deposit_status: "paid",
  ...over,
});

describe("balancesDue", () => {
  it("takes the paid deposit off the price when the ledger has nothing yet", () => {
    expect(balancesDue([job("a")], new Map())[0].balancePence).toBe(8000);
  });

  it("counts everything in the ledger, including cash on top of the deposit", () => {
    expect(balancesDue([job("a")], new Map([["a", 6000]]))[0].balancePence).toBe(4000);
  });

  it("leaves out jobs that are paid in full", () => {
    expect(balancesDue([job("a")], new Map([["a", 10000]]))).toEqual([]);
  });

  it("leaves out free jobs", () => {
    expect(balancesDue([job("a", { price_pence: 0, deposit_pence: 0, deposit_status: "none" })], new Map())).toEqual([]);
  });

  it("counts the whole price when the deposit was never paid", () => {
    expect(balancesDue([job("a", { deposit_status: "pending" })], new Map())[0].balancePence).toBe(10000);
  });

  it("puts whoever has waited longest first", () => {
    const rows = balancesDue(
      [job("new", { ends_at: "2026-11-09T12:00:00Z" }), job("old", { ends_at: "2026-10-20T12:00:00Z" })],
      new Map(),
    );
    expect(rows.map((r) => r.job.id)).toEqual(["old", "new"]);
  });
});
