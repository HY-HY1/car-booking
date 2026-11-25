import { describe, expect, it } from "vitest";
import { MAX_SEO_DESCRIPTION, parseVerification, seoDefaults, seoSchema } from "./seo";

describe("search and sharing", () => {
  it("reads nothing stored as visible with no overrides", () => {
    expect(seoSchema.parse(undefined)).toEqual({ hidden: false });
    expect(seoSchema.parse({ title: "", google_verification: "<bad>", hidden: true })).toEqual({ hidden: true });
  });

  it("takes the Search Console code from the whole tag or on its own", () => {
    const code = "abcDEF123_-xyz789abcDEF123";
    expect(parseVerification(`<meta name="google-site-verification" content="${code}" />`)).toBe(code);
    expect(parseVerification(`  ${code} `)).toBe(code);
    expect(parseVerification("not a code!")).toBeNull();
    expect(parseVerification("")).toBeNull();
  });

  it("makes a title and description from what the business does and where", () => {
    expect(seoDefaults({ name: "ASCND", trade: "detailing", mobile: true, unit: false, places: ["Cheltenham", "Gloucester"] })).toEqual({
      title: "ASCND · Mobile car detailing in Cheltenham",
      description: "Mobile car detailing in Cheltenham and Gloucester. See your price and book online in a couple of minutes.",
    });
    expect(seoDefaults({ name: "Shine", trade: "valeting", mobile: false, unit: true, places: [] }).title).toBe("Shine · Car valeting");
    const many = seoDefaults({ name: "Shine", trade: "both", mobile: true, unit: true, places: ["A", "B", "C", "D"] });
    expect(many.description).toBe(
      "Mobile car valeting and detailing in A, B, C and nearby, or drop your car off with us. See your price and book online in a couple of minutes.",
    );
  });

  it("leads with the tagline when there is one, and never runs over", () => {
    const d = seoDefaults({ name: "ASCND", trade: "detailing", mobile: true, unit: false, places: ["Cheltenham"], tagline: "Showroom shine, on your drive!" });
    expect(d.description).toBe("Showroom shine, on your drive. Covering Cheltenham. See your price and book online.");
    const long = seoDefaults({ name: "X", trade: null, mobile: true, unit: false, places: [], tagline: "word ".repeat(60) });
    expect(long.description.length).toBeLessThanOrEqual(MAX_SEO_DESCRIPTION);
    expect(long.description.endsWith("…")).toBe(true);
  });
});

describe("search and sharing form", () => {
  it("keeps what was typed, blanks as defaults, and pulls out the Search Console code", async () => {
    const { seoFormSchema } = await import("../settings/forms");
    expect(seoFormSchema.parse({ seo_title: "", seo_description: " Valeting in Bath ", google_verification: '<meta name="google-site-verification" content="abcdefghij12345" />', hidden: "on" })).toEqual({
      title: undefined,
      description: "Valeting in Bath",
      google_verification: "abcdefghij12345",
      hidden: true,
    });
    expect(seoFormSchema.safeParse({ google_verification: "nope!" }).success).toBe(false);
  });
});
