import { describe, expect, it } from "vitest";
import { checkServiceArea, estimateDriveMins, haversineMiles, isUkPostcode, outcode } from "./geo";

const bristol = { lat: 51.4545, lng: -2.5879 };
const bath = { lat: 51.3811, lng: -2.359 };

describe("postcodes", () => {
  it("validates and splits UK postcodes", () => {
    expect(isUkPostcode("bs16 3ab")).toBe(true);
    expect(isUkPostcode("SW1A1AA")).toBe(true);
    expect(isUkPostcode("BS16")).toBe(false);
    expect(outcode("bs16 3ab")).toBe("BS16");
    expect(outcode("SW1A1AA")).toBe("SW1A");
  });
});

describe("distances", () => {
  it("measures miles and estimates drive time", () => {
    const miles = haversineMiles(bristol, bath);
    expect(miles).toBeGreaterThan(10);
    expect(miles).toBeLessThan(12);
    expect(estimateDriveMins(miles)).toBe(35);
    expect(estimateDriveMins(0)).toBe(0);
  });
});

describe("checkServiceArea", () => {
  it("matches postcode districts", () => {
    const area = { districts: ["BS1", "BS16"] };
    expect(checkServiceArea("BS16 3AB", area, {}).ok).toBe(true);
    expect(checkServiceArea("BS1 4DJ", area, {}).ok).toBe(true);
    expect(checkServiceArea("BS10 5AA", area, {}).ok).toBe(false);
  });

  it("checks a radius from the base", () => {
    expect(checkServiceArea("BA1 1AA", { radius_miles: 15 }, { job: bath, base: bristol }).ok).toBe(true);
    expect(checkServiceArea("BA1 1AA", { radius_miles: 5 }, { job: bath, base: bristol })).toMatchObject({
      ok: false,
      reason: "outside_area",
    });
    expect(checkServiceArea("BA1 1AA", { radius_miles: 5 }, { base: bristol })).toMatchObject({
      ok: false,
      reason: "unknown_postcode",
    });
  });

  it("accepts a job inside any territory, ignoring the base", () => {
    const area = {
      territories: [
        { id: "default", name: "Default territory", lat: bristol.lat, lng: bristol.lng, radius_miles: 5 },
        { id: "bath", name: "Bath crew", lat: bath.lat, lng: bath.lng, radius_miles: 3 },
      ],
    };
    expect(checkServiceArea("BA1 1AA", area, { job: bath }).ok).toBe(true);
    expect(checkServiceArea("BS1 4DJ", area, { job: bristol }).ok).toBe(true);
    expect(checkServiceArea("SN1 1AA", area, { job: { lat: 51.56, lng: -1.78 } })).toMatchObject({
      ok: false,
      reason: "outside_area",
    });
    expect(checkServiceArea("SN1 1AA", area, {})).toMatchObject({ ok: false, reason: "unknown_postcode" });
  });

  it("allows anywhere when no area is set", () => {
    expect(checkServiceArea("ZE1 0AA", {}, {}).ok).toBe(true);
  });
});
