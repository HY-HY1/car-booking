import { describe, expect, it } from "vitest";
import { conditionLines, durationRange, oneSizeFitsAll, priceNotes, sizeRows } from "./service-pricing";

const service = {
  base_price_pence: 6000,
  duration_mins: 150,
  size_adjustments: { large: { price_pence: 1000, extra_mins: 30 }, xl: { price_pence: 2000, extra_mins: 60 } },
};

describe("a service's own page: prices", () => {
  it("prices each size from the base and its adjustment, with the time", () => {
    expect(sizeRows(service)).toEqual([
      { size: "small", name: "Small", examples: "Fiesta, Polo, Corsa", pricePence: 6000, durationMins: 150 },
      { size: "medium", name: "Medium", examples: "Golf, Focus, A3", pricePence: 6000, durationMins: 150 },
      { size: "large", name: "Large", examples: "estates, SUVs, Tesla Model Y", pricePence: 7000, durationMins: 180 },
      { size: "xl", name: "XL", examples: "7-seaters, pickups, vans", pricePence: 8000, durationMins: 210 },
    ]);
    expect(durationRange(sizeRows(service))).toEqual({ min: 150, max: 210 });
  });

  it("lifts a size to the minimum charge, and spots one price for all", () => {
    const flat = { base_price_pence: 2000, duration_mins: 60, size_adjustments: {} };
    expect(sizeRows(flat, 3000).every((r) => r.pricePence === 3000)).toBe(true);
    expect(oneSizeFitsAll(sizeRows(flat))).toBe(true);
    expect(oneSizeFitsAll(sizeRows(service))).toBe(false);
  });

  it("says how the car's condition changes the price", () => {
    const tiers = [
      { key: "a", label: "Light: just dusty", multiplier: 1, extra_mins: 0, needs_inspection: false },
      { key: "b", label: "Heavy: mud, pet hair", multiplier: 1.3, extra_mins: 30, needs_inspection: false },
      { key: "c", label: "Very heavy", multiplier: 1, extra_mins: 0, needs_inspection: true },
    ];
    expect(conditionLines(tiers, 6000)).toEqual([
      { label: "Light", effect: "No change" },
      { label: "Heavy", effect: "About £18 more, and takes longer" },
      { label: "Very heavy", effect: "Price confirmed when we see the car" },
    ]);
  });

  it("notes only the charges that apply", () => {
    expect(priceNotes({ offers_mobile: false, mobile_surcharge_pence: 500, travel_fee: null, min_price_pence: 0, condition_tiers: [] })).toEqual([]);
    expect(
      priceNotes({ offers_mobile: true, mobile_surcharge_pence: 500, travel_fee: { free_miles: 5, pence_per_mile: 50 }, min_price_pence: 3000, condition_tiers: [] }),
    ).toEqual([
      "Jobs at your address have a £5 call-out charge.",
      "Travel is free within 5 miles, then £0.50 a mile.",
      "Minimum charge £30.",
    ]);
  });
});
