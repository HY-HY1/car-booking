import { describe, expect, it } from "vitest";
import { DEFAULT_MULTI_CAR, multiCarOf, withExtraCars, type AddOn, type Service } from "./config";
import { depositFor, getQuote, QuoteError, travelFeeFor, type PricingSettings } from "./pricing";

const valet: Service = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Full valet",
  description: null,
  duration_mins: 240,
  base_price_pence: 14000,
  size_adjustments: {
    large: { price_pence: 3000, extra_mins: 60 },
    xl: { price_pence: 5000, extra_mins: 90 },
  },
  location_types: ["mobile", "unit"],
};

const petHair: AddOn = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Pet hair removal",
  description: null,
  price_pence: 2500,
  duration_mins: 45,
  service_ids: null,
};

const ceramicOnly: AddOn = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Ceramic top-up",
  description: null,
  price_pence: 5000,
  duration_mins: 30,
  service_ids: ["99999999-9999-4999-8999-999999999999"],
};

const settings: PricingSettings = {
  offers_mobile: true,
  offers_unit: false,
  deposit: { type: "percent", value: 25 },
  min_price_pence: 0,
  mobile_surcharge_pence: 0,
  condition_tiers: [],
};

const base = {
  service: valet,
  addOns: [petHair, ceramicOnly],
  addOnIds: [] as string[],
  sizeClass: "medium" as const,
  locationType: "mobile" as const,
  settings,
};

describe("getQuote", () => {
  it("prices the base service with no adjustments", () => {
    const q = getQuote(base);
    expect(q.total_pence).toBe(14000);
    expect(q.deposit_pence).toBe(3500);
    expect(q.duration_mins).toBe(240);
    expect(q.lines).toEqual([{ label: "Full valet", amount_pence: 14000 }]);
  });

  it("adds the vehicle size price and time", () => {
    const q = getQuote({ ...base, sizeClass: "large" });
    expect(q.total_pence).toBe(17000);
    expect(q.duration_mins).toBe(300);
    expect(q.lines[1]).toEqual({ label: "Large vehicle", amount_pence: 3000 });
  });

  it("adds selected add-ons once each", () => {
    const q = getQuote({ ...base, addOnIds: [petHair.id, petHair.id] });
    expect(q.total_pence).toBe(16500);
    expect(q.duration_mins).toBe(285);
    expect(q.add_on_ids).toEqual([petHair.id]);
  });

  it("rejects add-ons that don't go with the service", () => {
    expect(() => getQuote({ ...base, addOnIds: [ceramicOnly.id] })).toThrow(QuoteError);
  });

  it("rejects add-ons that don't exist", () => {
    expect(() =>
      getQuote({ ...base, addOnIds: ["44444444-4444-4444-8444-444444444444"] }),
    ).toThrowError(expect.objectContaining({ code: "unknown_add_on" }));
  });

  it("scales the service (not add-ons) by condition, rounded to the pound", () => {
    const q = getQuote({
      ...base,
      sizeClass: "large",
      addOnIds: [petHair.id],
      conditionKey: "heavy",
      settings: {
        ...settings,
        condition_tiers: [
          { key: "light", label: "Light", multiplier: 1, extra_mins: 0, needs_inspection: false },
          { key: "heavy", label: "Heavy: pet hair, mud", multiplier: 1.33, extra_mins: 60, needs_inspection: false },
        ],
      },
    });
    // (14000 + 3000) × 0.33 = 5610 → £56
    expect(q.lines).toContainEqual({ label: "Condition: Heavy", amount_pence: 5600 });
    expect(q.total_pence).toBe(14000 + 3000 + 5600 + 2500);
    expect(q.duration_mins).toBe(240 + 60 + 60 + 45);
  });

  it("prices an unchecked condition with no uplift and flags it for the owner", () => {
    const tiered = {
      ...settings,
      condition_tiers: [{ key: "heavy", label: "Heavy", multiplier: 1.5, extra_mins: 60, needs_inspection: false }],
    };
    const unchecked = getQuote({ ...base, settings: tiered });
    const plain = getQuote(base);
    expect(unchecked.total_pence).toBe(plain.total_pence);
    expect(unchecked.duration_mins).toBe(plain.duration_mins);
    expect(unchecked.condition_key).toBeNull();
    expect(unchecked.needs_inspection).toBe(true);
    expect(plain.needs_inspection).toBe(false);
    expect(() => getQuote({ ...base, settings: tiered, conditionKey: "filthy" })).toThrowError(
      expect.objectContaining({ code: "unknown_condition" }),
    );
  });

  it("flags needs-inspection tiers and keeps the base price", () => {
    const q = getQuote({
      ...base,
      conditionKey: "severe",
      settings: {
        ...settings,
        condition_tiers: [
          { key: "severe", label: "Severe", multiplier: 1, extra_mins: 0, needs_inspection: true },
        ],
      },
    });
    expect(q.needs_inspection).toBe(true);
    expect(q.total_pence).toBe(14000);
  });

  it("adds the mobile surcharge only for mobile jobs", () => {
    const both = { ...settings, offers_unit: true, mobile_surcharge_pence: 1000 };
    expect(getQuote({ ...base, settings: both }).total_pence).toBe(15000);
    expect(getQuote({ ...base, settings: both, locationType: "unit" }).total_pence).toBe(14000);
  });

  it("tops up to the minimum price", () => {
    const q = getQuote({ ...base, settings: { ...settings, min_price_pence: 20000 } });
    expect(q.total_pence).toBe(20000);
    expect(q.lines.at(-1)).toEqual({ label: "Minimum charge", amount_pence: 6000 });
  });

  it("refuses locations the tenant or service doesn't offer", () => {
    expect(() => getQuote({ ...base, locationType: "unit" })).toThrowError(
      expect.objectContaining({ code: "location_not_offered" }),
    );
    expect(() =>
      getQuote({
        ...base,
        service: { ...valet, location_types: ["unit"] },
        settings: { ...settings, offers_unit: true },
      }),
    ).toThrowError(expect.objectContaining({ code: "location_not_offered" }));
  });
});

describe("depositFor", () => {
  it("handles each deposit rule", () => {
    expect(depositFor(14000, { type: "none" })).toBe(0);
    expect(depositFor(14550, { type: "percent", value: 25 })).toBe(3638);
    expect(depositFor(14000, { type: "fixed", value_pence: 2000 })).toBe(2000);
    expect(depositFor(1500, { type: "fixed", value_pence: 2000 })).toBe(1500);
  });
});

describe("travelFeeFor", () => {
  const fee = { free_miles: 5, pence_per_mile: 100 };

  it("charges whole miles past the free distance, rounded up", () => {
    expect(travelFeeFor(fee, 7.2)).toEqual({ miles: 3, pence: 300 });
  });

  it("charges nothing inside the free distance", () => {
    expect(travelFeeFor(fee, 5)).toBeNull();
  });

  it("charges nothing when there's no fee or the distance is unknown", () => {
    expect(travelFeeFor(null, 20)).toBeNull();
    expect(travelFeeFor(fee, null)).toBeNull();
    expect(travelFeeFor({ free_miles: 0, pence_per_mile: 0 }, 20)).toBeNull();
  });
});

describe("more than one car", () => {
  const miniValet: Service = { ...valet, id: "44444444-4444-4444-8444-444444444444", name: "Mini valet", duration_mins: 60, base_price_pence: 4000 };

  it("prices each car, and adds each extra car's time less the setup saved", () => {
    const q = getQuote({
      ...base,
      settings: { ...settings, mobile_surcharge_pence: 1000 },
      extraCars: [{ service: miniValet, sizeClass: "large", addOnIds: [petHair.id] }],
      setupMins: 20,
    });
    // Car 2: 60 + 60 (large) + 45 (pet hair) = 165 min of its own, 145 added.
    expect(q.duration_mins).toBe(240 + 145);
    expect(q.extra_cars).toEqual([
      {
        service_id: miniValet.id,
        service_name: "Mini valet",
        size_class: "large",
        add_on_ids: [petHair.id],
        price_pence: 4000 + 3000 + 2500,
        own_mins: 165,
        added_mins: 145,
      },
    ]);
    // The call-out is charged once, for the visit.
    expect(q.lines).toEqual([
      { label: "Full valet", amount_pence: 14000 },
      { label: "Car 2: Mini valet", amount_pence: 4000 },
      { label: "Car 2: Large vehicle", amount_pence: 3000 },
      { label: "Car 2: Pet hair removal", amount_pence: 2500 },
      { label: "Mobile call-out", amount_pence: 1000 },
    ]);
    expect(q.total_pence).toBe(14000 + 9500 + 1000);
  });

  it("never takes an extra car below half its own time", () => {
    const q = getQuote({ ...base, extraCars: [{ service: miniValet, sizeClass: "medium", addOnIds: [] }], setupMins: 45 });
    expect(q.duration_mins).toBe(240 + 30);
  });

  it("charges the travel fee once however many cars there are", () => {
    const q = getQuote({
      ...base,
      settings: { ...settings, travel_fee: { free_miles: 5, pence_per_mile: 100 } },
      travelMiles: 8,
      extraCars: [
        { service: miniValet, sizeClass: "medium", addOnIds: [] },
        { service: miniValet, sizeClass: "medium", addOnIds: [] },
      ],
    });
    expect(q.lines.filter((l) => l.label.startsWith("Travel"))).toHaveLength(1);
    expect(q.lines.map((l) => l.label)).toContain("Car 3: Mini valet");
  });

  it("flags extra cars for the owner when prices depend on condition, as only the first has photos", () => {
    const tiers = [{ key: "clean", label: "Clean", multiplier: 1, extra_mins: 0, needs_inspection: false }];
    const one = getQuote({ ...base, settings: { ...settings, condition_tiers: tiers }, conditionKey: "clean" });
    expect(one.needs_inspection).toBe(false);
    const two = getQuote({
      ...base,
      settings: { ...settings, condition_tiers: tiers },
      conditionKey: "clean",
      extraCars: [{ service: miniValet, sizeClass: "medium", addOnIds: [] }],
    });
    expect(two.needs_inspection).toBe(true);
  });

  it("refuses an extra car whose service isn't offered there", () => {
    const shopOnly: Service = { ...miniValet, location_types: ["unit"] };
    expect(() => getQuote({ ...base, extraCars: [{ service: shopOnly, sizeClass: "medium", addOnIds: [] }] })).toThrow(QuoteError);
  });

  it("leaves a one-car quote exactly as it was", () => {
    expect(getQuote(base)).not.toHaveProperty("extra_cars");
  });
});

describe("multiCarOf", () => {
  it("falls back to the defaults when nothing's been set", () => {
    expect(multiCarOf(null)).toEqual(DEFAULT_MULTI_CAR);
    expect(multiCarOf({ enabled: false, max_cars: 3, setup_mins: 30 })).toEqual({ enabled: false, max_cars: 3, setup_mins: 30 });
    expect(multiCarOf({ enabled: true, max_cars: 9, setup_mins: 30 })).toEqual(DEFAULT_MULTI_CAR);
  });

  it("names the extra cars after the service", () => {
    expect(withExtraCars("Full valet", 0)).toBe("Full valet");
    expect(withExtraCars("Full valet", 1)).toBe("Full valet and 1 more car");
    expect(withExtraCars("Full valet", 2)).toBe("Full valet and 2 more cars");
  });
});
