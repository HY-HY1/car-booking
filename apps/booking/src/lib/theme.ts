import type { CSSProperties } from "react";
import { readableOn } from "@leadgen/core/branding/colors";
import type { Branding } from "@leadgen/core/tenants";

// CSS variables the booking pages are styled from (see globals.css). The same
// brand colours style the business's dashboard (core/branding/colors.ts).
export function themeStyle(branding: Branding): CSSProperties {
  return {
    "--brand": branding.primary_color,
    "--brand-fg": readableOn(branding.primary_color),
    "--accent": branding.accent_color,
    "--accent-fg": readableOn(branding.accent_color),
    // Not used on these pages yet; there for when it is.
    ...(branding.secondary_color && {
      "--secondary": branding.secondary_color,
      "--secondary-fg": readableOn(branding.secondary_color),
    }),
  } as CSSProperties;
}
