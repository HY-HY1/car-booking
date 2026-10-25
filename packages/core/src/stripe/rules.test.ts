import { describe, expect, it } from "vitest";
import {
  canTakeCardPayments,
  checkoutExpiresAt,
  collectsDepositOnline,
  depositStatusAfterRefund,
  holdMinutesFor,
  MIN_CHARGE_PENCE,
  MIN_ONLINE_HOLD_MINUTES,
} from "./rules";

describe("collectsDepositOnline", () => {
  it("needs a ready account and a deposit Stripe will accept", () => {
    expect(collectsDepositOnline(2900, true)).toBe(true);
    expect(collectsDepositOnline(2900, false)).toBe(false);
    expect(collectsDepositOnline(0, true)).toBe(false);
    expect(collectsDepositOnline(MIN_CHARGE_PENCE - 1, true)).toBe(false);
    expect(collectsDepositOnline(MIN_CHARGE_PENCE, true)).toBe(true);
  });
});

describe("hold and session timing", () => {
  it("lengthens short holds only when paying online", () => {
    expect(holdMinutesFor(15, false)).toBe(15);
    expect(holdMinutesFor(15, true)).toBe(MIN_ONLINE_HOLD_MINUTES);
    expect(holdMinutesFor(60, true)).toBe(60);
  });

  it("keeps the hold longer than the Checkout Session, which Stripe needs open 30+ minutes", () => {
    const now = Date.UTC(2026, 9, 14, 12, 0, 0);
    const sessionMinutes = (checkoutExpiresAt(now) * 1000 - now) / 60_000;
    expect(sessionMinutes).toBeGreaterThan(30);
    expect(MIN_ONLINE_HOLD_MINUTES).toBeGreaterThan(sessionMinutes);
  });
});

describe("canTakeCardPayments", () => {
  const withStatus = (status: string) => ({
    configuration: { merchant: { capabilities: { card_payments: { status } } } },
  });

  it("is true only when card payments are active", () => {
    expect(canTakeCardPayments(withStatus("active"))).toBe(true);
    for (const status of ["pending", "restricted", "rejected", "unsupported"]) {
      expect(canTakeCardPayments(withStatus(status))).toBe(false);
    }
  });

  it("is false when the merchant configuration is missing", () => {
    expect(canTakeCardPayments({})).toBe(false);
    expect(canTakeCardPayments({ configuration: null })).toBe(false);
    expect(canTakeCardPayments({ configuration: { merchant: null } })).toBe(false);
  });
});

describe("depositStatusAfterRefund", () => {
  it("tells full refunds from partial ones", () => {
    expect(depositStatusAfterRefund({ amount: 2900, amount_refunded: 2900 })).toBe("refunded");
    expect(depositStatusAfterRefund({ amount: 2900, amount_refunded: 1000 })).toBe("partially_refunded");
  });
});
