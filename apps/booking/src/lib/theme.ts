import type { CSSProperties } from "react";
import { bestTextOn, contrast, readableOn, visibleOn } from "@leadgen/core/branding/colors";
import type { Branding } from "@leadgen/core/tenants";
import { fontVariables } from "./fonts";

// The dark-mode card colour (--surface in globals.css): the brand is
// lightened until it stands out against it.
const DARK_SURFACE = "#171717";

// The brand on a dark page. A black or grey brand (the default is near-black)
// would only lighten to a flat mid-grey, so it turns near-white instead, the
// usual dark-mode button; a coloured brand is lightened just enough to show.
function darkBrandOf(hex: string) {
  if (contrast(hex, DARK_SURFACE) >= 3) return hex.toLowerCase();
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const grey = Math.max(...rgb) - Math.min(...rgb) < 24;
  return grey ? "#ededed" : visibleOn(hex, DARK_SURFACE);
}

// CSS variables the booking pages are styled from (see globals.css): the
// colours and typefaces. The same brand colours style the business's
// dashboard (core/branding/colors.ts).
export function themeStyle(branding: Branding): CSSProperties {
  const darkBrand = darkBrandOf(branding.primary_color);
  return {
    "--brand-light": branding.primary_color,
    "--brand-light-fg": readableOn(branding.primary_color),
    "--brand-dark": darkBrand,
    "--brand-dark-fg": bestTextOn(darkBrand),
    "--accent": branding.accent_color,
    "--accent-fg": readableOn(branding.accent_color),
    // Not used on these pages yet; there for when it is.
    ...(branding.secondary_color && {
      "--secondary": branding.secondary_color,
      "--secondary-fg": readableOn(branding.secondary_color),
    }),
    ...fontVariables(branding.heading_font, branding.body_font),
  } as CSSProperties;
}
