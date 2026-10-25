import { describe, expect, it } from "vitest";
import { CAR_MAKES, CAR_MODELS, POPULAR_MAKES } from "./catalog";

describe("car catalogue", () => {
  it("lists every popular make in the full list", () => {
    for (const make of POPULAR_MAKES) expect(CAR_MAKES).toContain(make);
  });

  it("has models for every make, with no duplicates", () => {
    for (const [make, models] of Object.entries(CAR_MODELS)) {
      expect(models.length, make).toBeGreaterThan(0);
      expect(new Set(models).size, make).toBe(models.length);
    }
  });

  it("sorts makes A to Z", () => {
    expect(CAR_MAKES).toEqual([...CAR_MAKES].sort((a, b) => a.localeCompare(b)));
  });
});
