import { describe, expect, it } from "vitest";
import {
  balanceDuePence,
  paymentLinkSchema,
  paymentStatus,
  paymentSummary,
  parsePounds,
  toPaymentRow,
  type ChargeLike,
} from "./payment-rules";

describe("parsePounds", () => {
  it("reads normal ways of typing an amount", () => {
    expect(parsePounds("45")).toBe(4500);
    expect(parsePounds("45.5")).toBe(4550);
    expect(parsePounds("£1,200.00")).toBe(120000);
    expect(parsePounds(" 0.30 ")).toBe(30);
  });

  it("refuses anything that isn't an exact amount in pounds and pence", () => {
    for (const bad of ["", "abc", "-5", "12.345", "1e3", "£", "12,5", "1.2.3"]) {
      expect(parsePounds(bad)).toBeNull();
    }
  });

  it("doesn't drift on floating point amounts", () => {
    expect(parsePounds("0.07")).toBe(7);
    expect(parsePounds("19.99")).toBe(1999);
  });
});

describe("paymentLinkSchema", () => {
  const ok = { description: "Balance: Full valet", amountPence: "129.50" };

  it("turns the typed amount into pence and defaults to one-off", () => {
    const r = paymentLinkSchema.parse(ok);
    expect(r.amountPence).toBe(12950);
    expect(r.singleUse).toBe(true);
  });

  it("rejects amounts Stripe or common sense wouldn't allow", () => {
    expect(paymentLinkSchema.safeParse({ ...ok, amountPence: "0.20" }).success).toBe(false);
    expect(paymentLinkSchema.safeParse({ ...ok, amountPence: "10000.01" }).success).toBe(false);
    expect(paymentLinkSchema.safeParse({ ...ok, amountPence: "ten" }).success).toBe(false);
    expect(paymentLinkSchema.safeParse({ ...ok, amountPence: "10000" }).success).toBe(true);
  });

  it("needs a description and a real booking id if one is given", () => {
    expect(paymentLinkSchema.safeParse({ ...ok, description: "  " }).success).toBe(false);
    expect(paymentLinkSchema.safeParse({ ...ok, bookingId: "not-a-uuid" }).success).toBe(false);
  });
});

describe("balanceDuePence", () => {
  it("takes off a deposit that was paid", () => {
    expect(balanceDuePence({ price_pence: 14000, deposit_pence: 3500, deposit_status: "paid" })).toBe(10500);
  });

  it("charges the full price when no deposit was actually received", () => {
    for (const status of ["none", "pending", "refunded", "waived"]) {
      expect(balanceDuePence({ price_pence: 14000, deposit_pence: 3500, deposit_status: status })).toBe(14000);
    }
  });

  it("never goes below zero", () => {
    expect(balanceDuePence({ price_pence: 1000, deposit_pence: 3000, deposit_status: "paid" })).toBe(0);
  });
});

const charge = (over: Partial<ChargeLike> = {}): ChargeLike => ({
  id: "ch_1",
  created: 1_791_911_948,
  amount: 1300,
  amount_refunded: 0,
  status: "succeeded",
  refunded: false,
  disputed: false,
  description: null,
  receipt_url: "https://pay.stripe.com/receipts/x",
  metadata: {},
  payment_intent: "pi_1",
  billing_details: { name: "Harvey", email: "h@example.com" },
  balance_transaction: { fee: 51, net: 1249 },
  ...over,
});

describe("paymentStatus", () => {
  it("ranks failed, pending, disputed, refunded, partly refunded, paid", () => {
    expect(paymentStatus(charge({ status: "failed" }))).toBe("failed");
    expect(paymentStatus(charge({ status: "pending" }))).toBe("pending");
    expect(paymentStatus(charge({ disputed: true, refunded: true }))).toBe("disputed");
    expect(paymentStatus(charge({ refunded: true, amount_refunded: 1300 }))).toBe("refunded");
    expect(paymentStatus(charge({ amount_refunded: 500 }))).toBe("partially_refunded");
    expect(paymentStatus(charge())).toBe("paid");
  });
});

describe("toPaymentRow", () => {
  const booking = "b8b20801-b964-4a46-a819-7f2795fed378";

  it("carries the amounts, fee and customer across", () => {
    const row = toPaymentRow(charge());
    expect(row).toMatchObject({
      amountPence: 1300,
      feePence: 51,
      netPence: 1249,
      customerName: "Harvey",
      paymentIntentId: "pi_1",
      status: "paid",
      source: "other",
      bookingId: null,
    });
    expect(row.createdAt).toBe(new Date(1_791_911_948_000).toISOString());
  });

  it("leaves fee and net empty while the balance transaction isn't loaded", () => {
    const row = toPaymentRow(charge({ balance_transaction: "txn_1" }));
    expect(row.feePence).toBeNull();
    expect(row.netPence).toBeNull();
  });

  it("tells booking deposits from payment links from everything else", () => {
    expect(toPaymentRow(charge({ metadata: { kind: "deposit", booking_id: booking } })).source).toBe("deposit");
    // Deposits taken before the 'kind' tag existed still carry the booking id.
    expect(toPaymentRow(charge({ metadata: { booking_id: booking } })).source).toBe("deposit");
    const link = toPaymentRow(charge({ metadata: { kind: "payment_link", booking_id: booking } }));
    expect(link.source).toBe("payment_link");
    expect(link.bookingId).toBe(booking);
  });

  it("ignores a booking id that isn't a uuid", () => {
    expect(toPaymentRow(charge({ metadata: { booking_id: "../../etc" } })).bookingId).toBeNull();
  });
});

describe("paymentSummary", () => {
  const booking = { price_pence: 10100, deposit_pence: 2525, deposit_status: "paid" };
  const pay = (amountPence: number, refundedPence = 0, status: "paid" | "failed" | "pending" = "paid") => ({
    status,
    amountPence,
    refundedPence,
  });

  it("uses the recorded deposit when Stripe has nothing yet", () => {
    expect(paymentSummary(booking, [])).toEqual({ paidPence: 2525, balancePence: 7575, fullyPaid: false });
    expect(paymentSummary(booking, null).paidPence).toBe(2525);
  });

  it("adds a balance paid by link to the deposit", () => {
    const s = paymentSummary(booking, [pay(2525), pay(7575)]);
    expect(s).toEqual({ paidPence: 10100, balancePence: 0, fullyPaid: true });
  });

  it("doesn't double count the deposit if both sources know about it", () => {
    expect(paymentSummary(booking, [pay(2525)]).paidPence).toBe(2525);
  });

  it("takes refunds off, and ignores failed attempts", () => {
    expect(paymentSummary({ ...booking, deposit_status: "refunded" }, [pay(2525, 2525)]).paidPence).toBe(0);
    expect(paymentSummary({ ...booking, deposit_status: "none" }, [pay(5000, 1000), pay(9999, 0, "failed")]).paidPence).toBe(4000);
  });

  it("counts a payment still processing so it isn't charged twice", () => {
    expect(paymentSummary({ ...booking, deposit_status: "pending" }, [pay(10100, 0, "pending")]).fullyPaid).toBe(true);
  });

  it("treats a free booking as nothing to pay", () => {
    expect(paymentSummary({ price_pence: 0, deposit_pence: 0, deposit_status: "none" }, []).fullyPaid).toBe(true);
  });
});
