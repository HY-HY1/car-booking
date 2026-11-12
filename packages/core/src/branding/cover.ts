import { z } from "zod";

// Which part of the cover image stays in view as the booking page's banner
// changes shape (wide on a computer, tall on a phone): CSS object-position,
// in percent. Set by dragging in Settings → Booking page. Safe in the browser.

const percent = z.number().min(0).max(100);
export const coverPositionSchema = z.object({ x: percent, y: percent });
export type CoverPosition = z.infer<typeof coverPositionSchema>;

// For a style attribute; unset is the middle.
export function coverObjectPosition(position: CoverPosition | undefined) {
  return position ? `${position.x}% ${position.y}%` : "50% 50%";
}
