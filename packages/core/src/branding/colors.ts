import type { Branding } from "../tenants";

// A business's brand colours (Settings → Booking page) turned into the
// colours each page uses. One brand for the booking page and the dashboard;
// the dashboard keeps its text and backgrounds neutral and only takes the
// brand for accents: buttons, the active nav item, focus rings and charts.
// Each colour is nudged until it stands out from the page behind it, light or
// dark, and text on it is black or white, whichever reads better. Pure.

const HEX = /^#[0-9a-f]{6}$/i;

function channels(hex: string) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

function toHex(rgb: number[]) {
  return `#${rgb.map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, "0")).join("")}`;
}

// WCAG relative luminance, 0 (black) to 1 (white).
export function luminance(hex: string) {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Black or white text on the colour: white unless it's a light colour. The
// booking page has always used this rule, so its buttons look the same.
export function readableOn(hex: string) {
  return luminance(hex) > 0.4 ? "#0a0a0a" : "#ffffff";
}

// Black or white text, whichever contrasts more. The dashboard uses this,
// since its colours may have been lightened for dark mode, where the booking
// page's rule would keep white text on a mid-tone.
export function bestTextOn(hex: string) {
  return contrast(hex, "#ffffff") >= contrast(hex, "#0a0a0a") ? "#ffffff" : "#0a0a0a";
}

// The colour, mixed towards white (on a dark page) or black (on a light one)
// just enough to reach `min` contrast with the page: 3:1 is what a button or
// highlight needs to be seen (WCAG non-text contrast). Colours that already
// stand out come back unchanged.
export function visibleOn(hex: string, background: string, min = 3) {
  if (contrast(hex, background) >= min) return hex.toLowerCase();
  const towards = luminance(background) > 0.5 ? [0, 0, 0] : [255, 255, 255];
  const from = channels(hex);
  for (let step = 1; step <= 20; step++) {
    const t = step / 20;
    const mixed = toHex(from.map((c, i) => c + (towards[i] - c) * t));
    if (contrast(mixed, background) >= min) return mixed;
  }
  return toHex(towards);
}

function toHsl(hex: string): [number, number, number] {
  const [r, g, b] = channels(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function fromHsl(h: number, s: number, l: number) {
  const hue = (p: number, q: number, t: number) => {
    const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (u < 1 / 6) return p + (q - p) * 6 * u;
    if (u < 1 / 2) return q;
    if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6;
    return p;
  };
  if (s === 0) return toHex([l * 255, l * 255, l * 255]);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return toHex([hue(p, q, h + 1 / 3), hue(p, q, h), hue(p, q, h - 1 / 3)].map((c) => c * 255));
}

// The dashboard's own neutral buttons (globals.css --primary), for a brand
// colour with no hue to keep.
const NEUTRAL = { light: "#171717", dark: "#e5e5e5" };

// The brand colour for a dashboard button or highlight. Like visibleOn, but it
// keeps the hue: the colour is made lighter or darker rather than mixed with
// white or black, which turns most colours a murky grey. A black, white or
// grey brand that doesn't stand out becomes the dashboard's own neutral
// (light on a dark page), so its buttons never look switched off.
export function brandOn(hex: string, background: string, min = 3) {
  if (contrast(hex, background) >= min) return hex.toLowerCase();
  const dark = luminance(background) <= 0.5;
  const [h, s, l] = toHsl(hex);
  if (s < 0.15) return dark ? NEUTRAL.dark : NEUTRAL.light;
  for (let step = 1; step <= 40; step++) {
    const t = step / 40;
    const shifted = fromHsl(h, s, dark ? l + (1 - l) * t : l * (1 - t));
    if (contrast(shifted, background) >= min) return shifted;
  }
  return dark ? "#ffffff" : "#000000";
}

// The dashboard's page and sidebar colours (globals.css), as hex, and how far
// the main colour must stand out from them. Dark mode asks for more, so a
// dark brand turns into a clear light button rather than a murky grey.
const LIGHT = { page: "#ffffff", sidebar: "#fafafa", min: 3 };
const DARK = { page: "#0a0a0a", sidebar: "#171717", min: 4.5 };

// CSS for a dashboard wrapped in [data-brand], in both modes. Every value is
// computed from colours the schema has already checked are #rrggbb, so it's
// safe to put in a <style> tag.
export function dashboardBrandCss(branding: Pick<Branding, "primary_color" | "accent_color" | "secondary_color">) {
  const mode = (bg: typeof LIGHT) => {
    const primary = brandOn(branding.primary_color, bg.page, bg.min);
    const sidebarPrimary = brandOn(branding.primary_color, bg.sidebar, bg.min);
    const vars: Record<string, string> = {
      "--primary": primary,
      "--primary-foreground": bestTextOn(primary),
      "--ring": primary,
      "--sidebar-primary": sidebarPrimary,
      "--sidebar-primary-foreground": bestTextOn(sidebarPrimary),
      "--viz-1": visibleOn(branding.accent_color, bg.page),
    };
    // The selected menu item: the secondary colour if there is one, else the main one.
    const secondary = branding.secondary_color && HEX.test(branding.secondary_color) ? branding.secondary_color : null;
    const navActive = secondary ? brandOn(secondary, bg.sidebar, 1.5) : sidebarPrimary;
    vars["--nav-active"] = navActive;
    vars["--nav-active-foreground"] = bestTextOn(navActive);
    return Object.entries(vars)
      .map(([k, v]) => `${k}: ${v};`)
      .join(" ");
  };
  return `[data-brand] { ${mode(LIGHT)} }\n.dark [data-brand] { ${mode(DARK)} }`;
}
