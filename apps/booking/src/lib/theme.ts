import type { CSSProperties } from "react";
import { bookingColors } from "@leadgen/core/branding/colors";
import type { Branding } from "@leadgen/core/tenants";
import { fontVariables } from "./fonts";

// CSS variables the booking pages are styled from (see globals.css): every
// brand colour in a light-page and a dark-page version (worked out in core
// branding/colors.ts), and the typefaces. globals.css picks the set for the
// visitor's mode. The same brand colours style the business's dashboard.
export function themeStyle(branding: Branding): CSSProperties {
  const { light, dark } = bookingColors(branding);
  return {
    "--brand-light": light.brand,
    "--brand-light-fg": light.brandFg,
    "--brand-dark": dark.brand,
    "--brand-dark-fg": dark.brandFg,
    "--panel-light": light.panel,
    "--panel-light-fg": light.panelFg,
    "--panel-dark": dark.panel,
    "--panel-dark-fg": dark.panelFg,
    "--accent-light": light.accent,
    "--accent-light-fg": light.accentFg,
    "--accent-dark": dark.accent,
    "--accent-dark-fg": dark.accentFg,
    "--wash-light": light.wash,
    "--wash-dark": dark.wash,
    // A dark-mode logo of their own needs no backing.
    ...(dark.logoBacking && !branding.logo_dark_url && { "--logo-backing-dark": dark.logoBacking }),
    ...fontVariables(branding.heading_font, branding.body_font),
  } as CSSProperties;
}
