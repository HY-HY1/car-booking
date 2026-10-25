import { describe, expect, it } from "vitest";
import type { ChargeLike } from "../stripe/payment-rules";
import { summariseIncome } from "./income";
import { periodRange } from "./periods";

const TZ = "Europe/London";
const NOW = new Date("2026-10-14T14:30:00Z"); // Wednesday
const week = periodRange("week", 0, NOW, TZ);

const at = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

let n = 0;
const charge = (iso: string, over: Partial<ChargeLike> = {}): ChargeLike => ({
  id: `ch_${++n}`,
  created: at(iso),
  amount: 10000,
  amount_refunded: 0,
  status: "succeeded",
  refunded: false,
  disputed: false,
  description: null,
  receipt_url: null,
  metadata: {},
  payment_intent: `pi_${n}`,
  billing_details: { name: null, email: null },
  balance_transaction: { fee: 200, net: 9800 },
  ...over,
});

describe("summariseIncome", () => {
  it("totals what was taken this period, with fees and take-home", () => {
    const s = summariseIncome([charge("2026-10-12T10:00:00Z"), charge("2026-10-14T09:00:00Z", { amount: 5000, balance_transaction: { fee: 100, net: 4900 } })], week);
    expect(s.current).toEqual({ grossPence: 15000, refundedPence: 0, incomePence: 15000, feesPence: 300, takeHomePence: 14700, payments: 2 });
  });

  it("takes refunds off the income but not the fee", () => {
    const s = summariseIncome([charge("2026-10-13T10:00:00Z", { amount_refunded: 4000 })], week);
    expect(s.current.refundedPence).toBe(4000);
    expect(s.current.incomePence).toBe(6000);
    expect(s.current.takeHomePence).toBe(5800);
  });

  it("ignores failed and pending payments", () => {
    const s = summariseIncome([charge("2026-10-13T10:00:00Z", { status: "failed" }), charge("2026-10-13T11:00:00Z", { status: "pending" })], week);
    expect(s.current.payments).toBe(0);
  });

  it("puts income in the right day of the week", () => {
    const s = summariseIncome([charge("2026-10-12T10:00:00Z"), charge("2026-10-14T09:00:00Z"), charge("2026-10-14T20:00:00Z")], week);
    expect(s.perBucket).toEqual([10000, 0, 20000, 0, 0, 0, 0]);
  });

  it("counts a late-night payment on the day it was in London, not in UTC", () => {
    // 23:30 UTC on Tuesday is 00:30 BST on Wednesday.
    const s = summariseIncome([charge("2026-10-13T23:30:00Z")], week);
    expect(s.perBucket[2]).toBe(10000);
    expect(s.perBucket[1]).toBe(0);
  });

  it("compares with the same stretch of the week before", () => {
    const s = summariseIncome(
      [
        charge("2026-10-05T10:00:00Z"), // Mon last week: in the window
        charge("2026-10-08T10:00:00Z"), // Thu last week: later than 'now' on Wednesday, so left out
        charge("2026-09-20T10:00:00Z"), // long ago
      ],
      week,
    );
    expect(s.previous.payments).toBe(1);
    expect(s.current.payments).toBe(0);
  });

  it("splits income by where it came from and lists the latest first", () => {
    const booking = "b8b20801-b964-4a46-a819-7f2795fed378";
    const s = summariseIncome(
      [
        charge("2026-10-12T10:00:00Z", { metadata: { kind: "deposit", booking_id: booking }, amount: 3000 }),
        charge("2026-10-13T10:00:00Z", { metadata: { kind: "payment_link" }, amount: 7000 }),
        charge("2026-10-14T10:00:00Z", { amount: 500 }),
      ],
      week,
    );
    expect(s.bySource).toEqual({ deposit: 3000, payment_link: 7000, other: 500 });
    expect(s.recent.map((r) => r.amountPence)).toEqual([500, 7000, 3000]);
  });

  it("copes with a charge whose fee isn't known yet", () => {
    const s = summariseIncome([charge("2026-10-12T10:00:00Z", { balance_transaction: "txn_1" })], week);
    expect(s.current.feesPence).toBe(0);
    expect(s.current.takeHomePence).toBe(10000);
  });
});
