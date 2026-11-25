import { describe, expect, it } from "vitest";
import { aboutFormSchema, homeFormSchema } from "../settings/forms";
import { MAX_GALLERY, aboutHeading, aboutParagraphs, aboutSchema, cleanFacts, galleryRows, gallerySchema } from "./about";
import { homeSchema } from "./home";

describe("about you", () => {
  it("reads nothing stored as nothing to show", () => {
    expect(aboutSchema.parse(undefined)).toEqual({ facts: [] });
    expect(aboutSchema.parse({ name: "", text: 4, facts: "insured" })).toEqual({ facts: [] });
  });

  it("heads the story with the name, or the business without one", () => {
    expect(aboutHeading({ facts: [], name: "Dan and Sophie" }, "Shine Co")).toBe("Meet Dan and Sophie");
    expect(aboutHeading({ facts: [] }, "Shine Co")).toBe("About Shine Co");
    expect(aboutHeading({ facts: [], name: "Dan", heading: "Why I started" }, "Shine Co")).toBe("Why I started");
  });

  it("splits the story into paragraphs at blank lines", () => {
    expect(aboutParagraphs("First.\nStill first.\n\n  \n\nSecond. ")).toEqual(["First.\nStill first.", "Second."]);
    expect(aboutParagraphs(undefined)).toEqual([]);
  });

  it("tidies the facts: blanks and repeats out, at most four", () => {
    expect(cleanFacts(["  Fully   insured ", "", "fully insured", "10 years", "Gtechniq approved", "Eco products", "Extra"])).toEqual([
      "Fully insured",
      "10 years",
      "Gtechniq approved",
      "Eco products",
    ]);
  });

  it("parses the form, storing blanks as unset", () => {
    const parsed = aboutFormSchema.parse({ name: " Dan ", heading: "", text: "One\r\n\r\n\r\n\r\nTwo", fact_0: "Insured", fact_2: "Insured" });
    expect(parsed).toEqual({ name: "Dan", heading: undefined, text: "One\n\nTwo", facts: ["Insured"] });
    expect(aboutFormSchema.safeParse({ fact_1: "x".repeat(41) }).success).toBe(false);
  });
});

describe("gallery", () => {
  const a = "https://x.supabase.co/a.webp";
  const b = "https://x.supabase.co/b.webp";

  it("drops a broken photo rather than the whole gallery", () => {
    expect(gallerySchema.parse([{ url: a, caption: "Before and after" }, { url: "not a url" }, { url: b, caption: "" }])).toEqual([
      { url: a, caption: "Before and after" },
      { url: b },
    ]);
    expect(gallerySchema.parse("nope")).toEqual([]);
  });

  it("keeps the form's order, ignoring photos that aren't in the gallery", () => {
    const rows = galleryRows([`saved:${b}`, "new:k1", "saved:https://evil.example/x.png", `saved:${a}`, `saved:${b}`, "junk"], ["  B  ", "", "", "A"], [
      { url: a },
      { url: b },
    ]);
    expect(rows).toEqual([
      { kind: "saved", url: b, caption: "B" },
      { kind: "new", key: "k1", caption: undefined },
      { kind: "saved", url: a, caption: "A" },
    ]);
  });

  it("takes at most the gallery's limit", () => {
    const rows = Array.from({ length: MAX_GALLERY + 3 }, (_, i) => `new:n${i}`);
    expect(galleryRows(rows, [], [])).toHaveLength(MAX_GALLERY);
  });
});

describe("home page phone", () => {
  it("shows the phone unless switched off", () => {
    expect(homeSchema.parse(undefined).show_phone).toBe(true);
    expect(homeSchema.parse({ show_phone: false }).show_phone).toBe(false);
    expect(homeFormSchema.parse({ places: "" }).show_phone).toBe(false);
    expect(homeFormSchema.parse({ places: "", show_phone: "on" }).show_phone).toBe(true);
  });
});
