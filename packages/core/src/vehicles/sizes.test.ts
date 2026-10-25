import { describe, expect, it } from "vitest";
import { CAR_MODELS } from "./catalog";
import { MODEL_SIZES, suggestSize } from "./sizes";

describe("model sizes", () => {
  it("gives every catalogue model exactly one size", () => {
    const missing: string[] = [];
    for (const [make, models] of Object.entries(CAR_MODELS)) {
      for (const model of models) if (!suggestSize(make, model)) missing.push(`${make} ${model}`);
    }
    expect(missing).toEqual([]);

    for (const [make, bySize] of Object.entries(MODEL_SIZES)) {
      const all = Object.values(bySize).flat();
      expect(new Set(all).size, `${make} has a model in two sizes`).toBe(all.length);
    }
  });

  it("only sizes models that are in the catalogue", () => {
    const unknown: string[] = [];
    for (const [make, bySize] of Object.entries(MODEL_SIZES)) {
      for (const model of Object.values(bySize).flat()) {
        if (!CAR_MODELS[make]?.includes(model)) unknown.push(`${make} ${model}`);
      }
    }
    expect(unknown).toEqual([]);
  });

  it("matches the size examples shown to customers", () => {
    expect(suggestSize("Ford", "Fiesta")).toBe("small");
    expect(suggestSize("Volkswagen", "Golf")).toBe("medium");
    expect(suggestSize("Tesla", "Model Y")).toBe("large");
    expect(suggestSize("Ford", "Transit")).toBe("xl");
    expect(suggestSize("Ford", "Something new")).toBeNull();
  });
});
