import { z } from "zod";

// What the booking page's home shows beyond the basics (Settings → Booking
// page → Home page). Kept in tenants.branding.home, so no migration: a
// missing or broken value falls back to the defaults instead of failing.

// The lengths an owner can pick for "the shortest job to look for", in minutes.
export const AVAILABILITY_LENGTHS = [30, 60, 90, 120, 180, 240, 360, 480] as const;

export const MAX_PLACES = 40;
const MAX_PLACE_LENGTH = 40;

export type HomeSettings = {
  // The strip under the heading: the next day with time free, and the week ahead.
  show_availability: boolean;
  // A day counts as free if a job this long still fits. Null = the shortest service.
  availability_mins: number | null;
  // The coverage map and postcode checker (only for businesses that travel).
  show_area: boolean;
  // Towns and villages listed beside the map, as the owner wrote them.
  places: string[];
};

export const HOME_DEFAULTS: HomeSettings = {
  show_availability: true,
  availability_mins: null,
  show_area: true,
  places: [],
};

export const homeSchema = z
  .object({
    show_availability: z.boolean().catch(true),
    availability_mins: z
      .number()
      .refine((n) => (AVAILABILITY_LENGTHS as readonly number[]).includes(n))
      .nullable()
      .catch(null),
    show_area: z.boolean().catch(true),
    places: z.array(z.string().trim().min(1).max(MAX_PLACE_LENGTH)).max(MAX_PLACES).catch([]),
  })
  .catch(HOME_DEFAULTS);

// "Cheltenham, Charlton Kings\nPrestbury" → one entry each: trimmed, repeats
// taken out (ignoring case), each cut to length, at most MAX_PLACES.
export function parsePlaces(text: string): string[] {
  const seen = new Set<string>();
  const places: string[] = [];
  for (const part of text.split(/[,\n;]/)) {
    const place = part.trim().replace(/\s+/g, " ").slice(0, MAX_PLACE_LENGTH).trim();
    const key = place.toLowerCase();
    if (!place || seen.has(key)) continue;
    seen.add(key);
    places.push(place);
    if (places.length === MAX_PLACES) break;
  }
  return places;
}
