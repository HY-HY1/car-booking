import { describe, expect, it } from "vitest";
import { depositOwed } from "./manage-rules";
import { manualBookingFormSchema, settleManualPrice } from "./manual-rules";
import type { Quote } from "./pricing";

const SERVICE = "11111111-1111-4111-8111-111111111111";
const EXTRA = "22222222-2222-4222-8222-222222222222";

const form = (overrides: Record<string, string> = {}) => ({
  name: "Sam Smith",
  email: "",
  phone: "07700 900123",
  service_id: SERVICE,
  size_class: "medium",
  location_type: "mobile",
  address_line: "12 High Street",
  postcode: "bs1 4dj",
  date: "2026-11-20",
  time: "09:30",
  ...overrides,
});

describe("add booking form", () => {
  it("reads what was typed", () => {
    const parsed = manualBookingFormSchema.safeParse(
      form({ add_on_ids: `${EXTRA}`, price: "£85", deposit: "", registration: "ab12 cde", send_confirmation: "on" }),
    );
    expect(parsed.success && parsed.data).toMatchObject({
      customerId: null,
      contact: { name: "Sam Smith", email: null, phone: "+447700900123" },
      addOnIds: [EXTRA],
      postcode: "BS1 4DJ",
      pricePence: 8500,
      depositPence: null,
      durationMins: null,
      resourceId: null,
      vehicle: { registration: "AB12CDE" },
      sendConfirmation: true,
      requestDeposit: false,
    });
  });

  it("needs a postcode for a job at an address, and none at the shop", () => {
    expect(manualBookingFormSchema.safeParse(form({ postcode: "" })).success).toBe(false);
    const shop = manualBookingFormSchema.safeParse(form({ location_type: "unit", postcode: "" }));
    expect(shop.success && shop.data).toMatchObject({ postcode: null, addressLine: null });
  });

  it("won't take a deposit over the price, or ask for one without an email", () => {
    expect(manualBookingFormSchema.safeParse(form({ price: "50", deposit: "60" })).success).toBe(false);
    expect(manualBookingFormSchema.safeParse(form({ request_deposit: "on" })).success).toBe(false);
    expect(manualBookingFormSchema.safeParse(form({ request_deposit: "on", email: "sam@example.com" })).success).toBe(true);
  });

  it("checks the length and the time", () => {
    expect(manualBookingFormSchema.safeParse(form({ duration_mins: "10" })).success).toBe(false);
    expect(manualBookingFormSchema.safeParse(form({ time: "9:30" })).success).toBe(false);
    const long = manualBookingFormSchema.safeParse(form({ duration_mins: "240" }));
    expect(long.success && long.data.durationMins).toBe(240);
  });
});

describe("settling the price", () => {
  const quote: Quote = {
    service_id: SERVICE,
    service_name: "Full valet",
    size_class: "medium",
    condition_key: null,
    location_type: "mobile",
    add_on_ids: [],
    lines: [{ label: "Full valet", amount_pence: 6000 }],
    total_pence: 6000,
    deposit_pence: 1500,
    duration_mins: 120,
    needs_inspection: false,
  };
  const none = { pricePence: null, durationMins: null, depositPence: null };

  it("uses the price list when nothing is changed", () => {
    expect(settleManualPrice(quote, { type: "percent", value: 25 }, none)).toEqual({
      lines: quote.lines,
      totalPence: 6000,
      depositPence: 1500,
      durationMins: 120,
    });
  });

  it("shows a changed price as its own line, with the usual deposit on the new price", () => {
    const settled = settleManualPrice(quote, { type: "percent", value: 25 }, { ...none, pricePence: 5000 });
    expect(settled.lines.at(-1)).toEqual({ label: "Price adjusted", amount_pence: -1000 });
    expect(settled.lines.reduce((sum, l) => sum + l.amount_pence, 0)).toBe(5000);
    expect(settled.depositPence).toBe(1250);
    expect(settleManualPrice(quote, { type: "fixed", value_pence: 2000 }, { ...none, pricePence: 5000 }).depositPence).toBe(2000);
  });

  it("takes the owner's deposit and length, a deposit never over the price", () => {
    expect(settleManualPrice(quote, { type: "none" }, { pricePence: null, durationMins: 90, depositPence: 0 })).toMatchObject({
      depositPence: 0,
      durationMins: 90,
    });
    expect(settleManualPrice(quote, { type: "full" }, { ...none, pricePence: 2000 }).depositPence).toBe(2000);
  });
});

describe("deposit owed", () => {
  it("is a live booking's unpaid deposit, at least Stripe's minimum", () => {
    expect(depositOwed({ status: "confirmed", depositPence: 2000, depositStatus: "pending" })).toBe(true);
    expect(depositOwed({ status: "requested", depositPence: 2000, depositStatus: "pending" })).toBe(true);
    expect(depositOwed({ status: "confirmed", depositPence: 2000, depositStatus: "paid" })).toBe(false);
    expect(depositOwed({ status: "held", depositPence: 2000, depositStatus: "pending" })).toBe(false);
    expect(depositOwed({ status: "cancelled", depositPence: 2000, depositStatus: "pending" })).toBe(false);
    expect(depositOwed({ status: "confirmed", depositPence: 20, depositStatus: "pending" })).toBe(false);
  });
});
