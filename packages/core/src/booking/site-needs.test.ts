import { describe, expect, it } from "vitest";
import { siteNeedsFormSchema } from "./settings-rules";
import { NO_SITE_NEEDS, siteNeedsOf, siteNeedsText, unmetSiteNeed } from "./site-needs";

describe("site needs", () => {
  it("reads a missing or broken setting as nothing required", () => {
    expect(siteNeedsOf(null)).toEqual(NO_SITE_NEEDS);
    expect(siteNeedsOf("water")).toEqual(NO_SITE_NEEDS);
    expect(siteNeedsOf({ water: true, power: "yes" })).toEqual({ water: true, power: false });
  });

  it("says what's needed in one phrase", () => {
    expect(siteNeedsText(NO_SITE_NEEDS)).toBeNull();
    expect(siteNeedsText({ water: true, power: false })).toBe("an outside tap");
    expect(siteNeedsText({ water: true, power: true })).toBe("an outside tap and a power socket");
  });

  it("finds a required thing not answered yes", () => {
    const both = { water: true, power: true };
    expect(unmetSiteNeed(both, { water: "yes", power: "yes" })).toBeNull();
    expect(unmetSiteNeed(both, { water: "yes", power: "no" })).toBe("power");
    expect(unmetSiteNeed(both, {})).toBe("water");
    expect(unmetSiteNeed(both, undefined)).toBe("water");
    expect(unmetSiteNeed({ water: false, power: true }, { water: "no", power: "yes" })).toBeNull();
  });

  it("parses the settings form's switches", () => {
    expect(siteNeedsFormSchema.parse({ requires_water: "on" })).toEqual({ site_requirements: { water: true, power: false } });
    expect(siteNeedsFormSchema.parse({})).toEqual({ site_requirements: { water: false, power: false } });
  });
});
