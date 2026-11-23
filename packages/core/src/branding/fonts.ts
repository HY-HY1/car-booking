import { z } from "zod";

// The typefaces a business can pick for its booking page (Settings → Booking
// page → Look and feel). Each app loads the files itself with next/font, so
// they're served from our own domain and visitors' browsers never contact
// Google: apps/booking/src/lib/fonts.ts for the page, and the dashboard's
// settings/booking-fonts.ts for the preview. Both are typed against FontKey,
// so adding one here fails the build until it's loaded in each.

export type FontStyle = "modern" | "bold" | "serif";

export const FONT_STYLES: Record<FontStyle, string> = {
  modern: "Clean and modern",
  bold: "Bold and condensed",
  serif: "Classic serif",
};

type FontInfo = {
  label: string;
  style: FontStyle;
  // Display faces that only read well large: offered for headings, not body text.
  headingOnly?: true;
};

export const FONTS = {
  geist: { label: "Geist", style: "modern" },
  inter: { label: "Inter", style: "modern" },
  dm_sans: { label: "DM Sans", style: "modern" },
  manrope: { label: "Manrope", style: "modern" },
  plus_jakarta: { label: "Plus Jakarta Sans", style: "modern" },
  poppins: { label: "Poppins", style: "modern" },
  montserrat: { label: "Montserrat", style: "modern" },
  nunito: { label: "Nunito", style: "modern" },
  work_sans: { label: "Work Sans", style: "modern" },
  space_grotesk: { label: "Space Grotesk", style: "modern" },
  oswald: { label: "Oswald", style: "bold", headingOnly: true },
  bebas_neue: { label: "Bebas Neue", style: "bold", headingOnly: true },
  archivo_black: { label: "Archivo Black", style: "bold", headingOnly: true },
  playfair: { label: "Playfair Display", style: "serif", headingOnly: true },
  dm_serif: { label: "DM Serif Display", style: "serif", headingOnly: true },
  fraunces: { label: "Fraunces", style: "serif" },
  lora: { label: "Lora", style: "serif" },
} as const satisfies Record<string, FontInfo>;

export type FontKey = keyof typeof FONTS;

// The booking page's own typeface, used when none is picked.
export const DEFAULT_FONT: FontKey = "geist";

export const FONT_KEYS = Object.keys(FONTS) as [FontKey, ...FontKey[]];

export const isBodyFont = (key: FontKey) => !(FONTS[key] as FontInfo).headingOnly;

export const BODY_FONT_KEYS = FONT_KEYS.filter(isBodyFont) as [FontKey, ...FontKey[]];

// Stored values: an unknown or retired key reads as unset (the default)
// rather than breaking the page.
export const headingFontSchema = z.enum(FONT_KEYS).optional().catch(undefined);
export const bodyFontSchema = z.enum(BODY_FONT_KEYS).optional().catch(undefined);

// The picks grouped by style, in list order, for a dropdown.
export function fontGroups(keys: readonly FontKey[] = FONT_KEYS) {
  return (Object.keys(FONT_STYLES) as FontStyle[])
    .map((style) => ({
      style,
      label: FONT_STYLES[style],
      fonts: keys.filter((k) => FONTS[k].style === style).map((k) => ({ key: k, label: FONTS[k].label })),
    }))
    .filter((g) => g.fonts.length > 0);
}
