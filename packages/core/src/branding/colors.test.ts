import { describe, expect, it } from "vitest";
import { bestTextOn, contrast, dashboardBrandCss, readableOn, visibleOn } from "./colors";

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
