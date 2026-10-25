import type { CSSProperties } from "react";
import type { Branding } from "@leadgen/core/tenants";

// Black or white text, whichever reads better on the brand colour.
function readableOn(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.4 ? "#0a0a0a" : "#ffffff";
}

// CSS variables the booking pages are styled from (see globals.css).
export function themeStyle(branding: Branding): CSSProperties {
  return {
    "--brand": branding.primary_color,
    "--brand-fg": readableOn(branding.primary_color),
    "--accent": branding.accent_color,
    "--accent-fg": readableOn(branding.accent_color),
  } as CSSProperties;
}
