import { describe, expect, it } from "vitest";
import { bestTextOn, bookingColors, brandOn, contrast, dashboardBrandCss, luminance, readableOn, visibleOn } from "./colors";

describe("readableOn", () => {
  it("picks white text on dark colours and black on light ones", () => {
    expect(readableOn("#18181b")).toBe("#ffffff");
    expect(readableOn("#fbbf24")).toBe("#0a0a0a");
    expect(readableOn("#3b82f6")).toBe("#ffffff");
  });
});

describe("visibleOn", () => {
  it("leaves colours that already stand out alone", () => {
    expect(visibleOn("#3b82f6", "#ffffff")).toBe("#3b82f6");
    expect(visibleOn("#18181b", "#ffffff")).toBe("#18181b");
  });

  it("lightens a dark brand colour for a dark page, and darkens a pale one for a light page", () => {
    const onDark = visibleOn("#18181b", "#0a0a0a");
    expect(contrast(onDark, "#0a0a0a")).toBeGreaterThanOrEqual(3);
    const onLight = visibleOn("#fef08a", "#ffffff");
    expect(contrast(onLight, "#ffffff")).toBeGreaterThanOrEqual(3);
  });
});

describe("dashboardBrandCss", () => {
  const brand = { primary_color: "#9a3412", accent_color: "#fbbf24", secondary_color: undefined };

  it("sets the main colour, its text colour and the charts for both modes", () => {
    const css = dashboardBrandCss(brand);
    expect(css).toMatch(/^\[data-brand\] \{ --primary: #9a3412; --primary-foreground: #ffffff;/);
    expect(css).toContain(".dark [data-brand] {");
    expect(css).toContain("--viz-1:");
  });

  it("marks the active nav item in the secondary colour, or the main one without it", () => {
    expect(dashboardBrandCss(brand)).toContain("--nav-active: #9a3412;");
    expect(dashboardBrandCss({ ...brand, secondary_color: "#0ea5e9" })).toContain("--nav-active: #0ea5e9;");
  });

  it("turns a near-black brand into a clear light button in dark mode, not a grey one", () => {
    const css = dashboardBrandCss({ ...brand, primary_color: "#18181b" });
    const dark = css.split(".dark [data-brand]")[1];
    expect(dark).toContain("--primary: #e5e5e5;");
    expect(dark).toContain("--primary-foreground: #0a0a0a;");
  });

  it("keeps a dark brand's hue when lightening it for dark mode", () => {
    const lifted = brandOn("#1e3a8a", "#0a0a0a", 4.5);
    expect(contrast(lifted, "#0a0a0a")).toBeGreaterThanOrEqual(4.5);
    const [r, , b] = [1, 3, 5].map((i) => parseInt(lifted.slice(i, i + 2), 16));
    expect(b).toBeGreaterThan(r + 40);
  });

  it("never writes anything but #rrggbb values", () => {
    const css = dashboardBrandCss({ ...brand, secondary_color: "red; } body { display: none" });
    expect(css).not.toContain("display");
  });
});

describe("bestTextOn", () => {
  it("puts dark text on a brand colour lightened for dark mode", () => {
    const lifted = visibleOn("#9a3412", "#0a0a0a", 4.5);
    expect(bestTextOn(lifted)).toBe("#0a0a0a");
    expect(contrast(bestTextOn(lifted), lifted)).toBeGreaterThanOrEqual(4.5);
    expect(bestTextOn("#9a3412")).toBe("#ffffff");
  });
});

describe("bookingColors", () => {
  const DARK_SURFACE = "#171717";
  const colors = (primary_color: string, accent_color: string) => bookingColors({ primary_color, accent_color });

  it("uses the colours as chosen in light mode", () => {
    const { light } = colors("#9A3412", "#FBBF24");
    expect(light).toEqual({
      brand: "#9a3412",
      brandFg: "#ffffff",
      panel: "#9a3412",
      panelFg: "#ffffff",
      accent: "#fbbf24",
      accentFg: "#0a0a0a",
      wash: light.wash,
    });
  });

  it("darkens a brand too pale for buttons on the light page, but keeps the header as chosen", () => {
    const white = colors("#ffffff", "#15803d").light;
    expect(white.panel).toBe("#ffffff");
    expect(contrast(white.brand, "#fafafa")).toBeGreaterThanOrEqual(3);
    expect(contrast(white.brand, white.brandFg)).toBeGreaterThanOrEqual(4.5);
    const yellow = colors("#facc15", "#1e3a8a").light;
    expect(contrast(yellow.brand, "#fafafa")).toBeGreaterThanOrEqual(3);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(yellow.brand.slice(i, i + 2), 16));
    expect(Math.min(r, g)).toBeGreaterThan(b + 30);
  });

  it("washes the hero in the brand's hue, or the accent's for a white brand, faint enough for the page's text", () => {
    const rust = colors("#9a3412", "#fbbf24");
    const [r, , b] = [1, 3, 5].map((i) => parseInt(rust.light.wash.slice(i, i + 2), 16));
    expect(r).toBeGreaterThan(b);
    expect(contrast(rust.light.wash, "#0a0a0a")).toBeGreaterThanOrEqual(12);
    expect(contrast(rust.dark.wash, "#f5f5f5")).toBeGreaterThanOrEqual(12);
    // White brand, green accent: a green wash, not white on white.
    const ascnd = colors("#ffffff", "#15803d").light.wash;
    const [, g, b2] = [1, 3, 5].map((i) => parseInt(ascnd.slice(i, i + 2), 16));
    expect(g).toBeGreaterThan(b2);
    expect(ascnd).not.toBe("#ffffff");
    expect(colors("#ffffff", "#000000").light.wash).toBe("#f0f0f0");
  });

  it("leaves a deep brand and a bright accent alone in dark mode", () => {
    const { dark } = colors("#9a3412", "#fbbf24");
    expect(dark.panel).toBe("#9a3412");
    expect(dark.accent).toBe("#fbbf24");
    expect(dark.accentFg).toBe("#0a0a0a");
    expect(dark.logoBacking).toBeNull();
  });

  it("deepens a light brand's panels for dark mode, keeping the hue, and backs the logo", () => {
    const { dark } = colors("#facc15", "#1e3a8a");
    expect(contrast(dark.panel, "#ffffff")).toBeGreaterThanOrEqual(7);
    expect(dark.panelFg).toBe("#ffffff");
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(dark.panel.slice(i, i + 2), 16));
    expect(r).toBeGreaterThan(b + 30);
    expect(g).toBeGreaterThan(b + 30);
    expect(dark.logoBacking).toBe("#facc15");
  });

  it("turns a white brand's panels dark, not grey-white", () => {
    const { dark } = colors("#ffffff", "#000000");
    expect(luminance(dark.panel)).toBeLessThan(0.05);
    expect(dark.logoBacking).toBe("#ffffff");
  });

  it("lightens a dark accent until it shows on the dark page, keeping the hue", () => {
    const { dark } = colors("#18181b", "#1e3a8a");
    expect(contrast(dark.accent, DARK_SURFACE)).toBeGreaterThanOrEqual(3);
    const [r, , b] = [1, 3, 5].map((i) => parseInt(dark.accent.slice(i, i + 2), 16));
    expect(b).toBeGreaterThan(r + 40);
    expect(contrast(dark.accent, dark.accentFg)).toBeGreaterThanOrEqual(4.5);
  });

  it("turns a black accent into a light button in dark mode", () => {
    const { dark } = colors("#9a3412", "#000000");
    expect(luminance(dark.accent)).toBeGreaterThan(0.6);
    expect(dark.accentFg).toBe("#0a0a0a");
  });

  it("keeps the near-black default brand as a near-white button in dark mode", () => {
    const { dark } = colors("#18181b", "#3b82f6");
    expect(dark.brand).toBe("#ededed");
    expect(dark.brandFg).toBe("#0a0a0a");
    expect(dark.panel).toBe("#18181b");
  });
});
