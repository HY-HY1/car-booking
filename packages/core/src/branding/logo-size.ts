import { z } from "zod";

// How big the logo shows in the booking pages' header (Settings → Booking
// page → Images). Heights in pixels; the width follows the logo's shape, up
// to a limit, so a long, thin logo doesn't push the menu off the page.
// Medium is the size every logo had before there was a choice.
export const LOGO_SIZES = {
  small: { label: "Small", height: 24, maxWidth: 140 },
  medium: { label: "Medium", height: 32, maxWidth: 176 },
  large: { label: "Large", height: 44, maxWidth: 230 },
  extra_large: { label: "Extra large", height: 56, maxWidth: 280 },
} as const;

export type LogoSize = keyof typeof LOGO_SIZES;
export const LOGO_SIZE_KEYS = Object.keys(LOGO_SIZES) as [LogoSize, ...LogoSize[]];
export const DEFAULT_LOGO_SIZE: LogoSize = "medium";

// On a phone the header has less room: the bigger sizes are capped.
export const PHONE_LOGO_MAX_HEIGHT = 40;

export const logoSizeSchema = z.enum(LOGO_SIZE_KEYS).catch(DEFAULT_LOGO_SIZE);

// The logo's box on a big screen and on a phone, in pixels.
export function logoBox(size: LogoSize) {
  const { height, maxWidth } = LOGO_SIZES[size];
  const phoneHeight = Math.min(height, PHONE_LOGO_MAX_HEIGHT);
  return { height, maxWidth, phoneHeight, phoneMaxWidth: Math.round((maxWidth * phoneHeight) / height) };
}
