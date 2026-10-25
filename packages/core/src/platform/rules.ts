import { z } from "zod";
import { weeklyHoursSchema, type DayKey, type WeeklyHours } from "../booking/config";
import { isUkPostcode } from "../booking/geo";
import { normalizePostcode } from "../customer-fields";
import { isReservedSlug } from "../reserved-slugs";

// What it takes to set up a new business, without touching the database, so
// it can be tested. The server half is in businesses.ts.

export function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

// A business's slug is its booking address (/booking/<slug>, <slug>.domain.com)
// and its dashboard address (/app/<slug>), so it has to be safe in both.
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens.")
  .min(3, "Use at least 3 characters.")
  .max(40, "Keep it under 40 characters.")
  .refine((s) => !isReservedSlug(s), "That one is reserved. Pick another.");

// "https://Bookings.Example.co.uk/" → "bookings.example.co.uk". Customers reach
// a business by its hostname, so this must be a bare, lowercase hostname.
export function normalizeHostname(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}

const HOSTNAME = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export const hostnameSchema = z
  .string()
  .transform(normalizeHostname)
  .refine(
    (h) => HOSTNAME.test(h) || /^[a-z0-9-]+\.localhost$/.test(h),
    "Enter a hostname like bookings.example.co.uk.",
  );

const hexColor = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a colour like #0f172a.");

export const HOURS_PRESETS = {
  weekdays: "Monday to Friday, 8am to 5pm",
  weekdays_sat: "Monday to Friday 8am to 5pm, Saturday 9am to 3pm",
  every_day: "Every day, 8am to 5pm",
  none: "No hours yet (nothing bookable until set)",
} as const;
export type HoursPreset = keyof typeof HOURS_PRESETS;

export function weeklyHoursFor(preset: HoursPreset): WeeklyHours {
  const day = (open: string, close: string): [string, string][] => [[open, close]];
  const weekdays: DayKey[] = ["mon", "tue", "wed", "thu", "fri"];
  const hours: WeeklyHours = {};
  if (preset === "none") return hours;
  for (const d of weekdays) hours[d] = day("08:00", "17:00");
  if (preset === "weekdays_sat") hours.sat = day("09:00", "15:00");
  if (preset === "every_day") {
    hours.sat = day("08:00", "17:00");
    hours.sun = day("08:00", "17:00");
  }
  return weeklyHoursSchema.parse(hours);
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || undefined);

export const LOCATIONS = ["mobile", "unit", "both"] as const;
export type Location = (typeof LOCATIONS)[number];

export const newBusinessSchema = z.object({
  name: z.string().trim().min(1, "Enter the business name.").max(100),
  slug: slugSchema,
  ownerEmail: z.string().trim().toLowerCase().pipe(z.email("Enter the owner's email address.")),
  // Their own domain, if they already have one (book.theirsite.co.uk). The
  // booking pages work at the business's slug address without it.
  hostname: z.preprocess((v) => (typeof v === "string" && !v.trim() ? undefined : v), hostnameSchema.optional()),
  primaryColor: hexColor.default("#18181b"),
  accentColor: hexColor.default("#3b82f6"),
  tagline: optionalText(120),
  hours: z.enum(Object.keys(HOURS_PRESETS) as [HoursPreset, ...HoursPreset[]]).default("weekdays"),
  basePostcode: z
    .string()
    .trim()
    .refine((v) => v === "" || isUkPostcode(v), "Enter a full UK postcode, like BS1 4DJ.")
    .transform((v) => (v === "" ? undefined : normalizePostcode(v)))
    .optional(),
  radiusMiles: z.coerce.number().int().min(1, "At least 1 mile.").max(200).optional(),
  depositPercent: z.coerce.number().min(0, "0 to 100.").max(100, "0 to 100.").default(25),
  starterServices: z.boolean().default(true),
  addMe: z.boolean().default(true),
  // Where jobs happen. A unit needs its postcode (the database insists), so
  // that's checked below; the platform panel only ever creates mobile ones.
  locations: z.enum(LOCATIONS).default("mobile"),
  unitPostcode: z
    .string()
    .trim()
    .refine((v) => v === "" || isUkPostcode(v), "Enter a full UK postcode, like BS1 4DJ.")
    .transform((v) => (v === "" ? undefined : normalizePostcode(v)))
    .optional(),
}).refine((b) => b.locations === "mobile" || b.unitPostcode, {
  path: ["unitPostcode"],
  message: "Enter the postcode of your unit.",
});
export type NewBusiness = z.output<typeof newBusinessSchema>;

// The booking_settings row for a new business. Column defaults cover the
// rest (timezone, slot length, notice, hold time).
export function bookingSettingsFor(input: NewBusiness) {
  const radius = input.basePostcode && input.radiusMiles ? { radius_miles: input.radiusMiles } : {};
  const offersUnit = input.locations !== "mobile";
  return {
    weekly_hours: weeklyHoursFor(input.hours),
    offers_mobile: input.locations !== "unit",
    offers_unit: offersUnit,
    ...(offersUnit && { unit_postcode: input.unitPostcode }),
    base_postcode: input.basePostcode ?? null,
    service_area: radius,
    deposit:
      input.depositPercent > 0
        ? { type: "percent" as const, value: input.depositPercent }
        : { type: "none" as const },
  };
}

// A van for mobile work and a bay for a unit; a business doing both starts
// with one of each. More vans and bays are added under Settings → Booking.
export function startingResources(locations: Location = "mobile") {
  return [
    ...(locations !== "unit" ? [{ name: "Van", location_types: ["mobile"] }] : []),
    ...(locations !== "mobile" ? [{ name: "Bay", location_types: ["unit"] }] : []),
  ].map((r, i) => ({ ...r, sort_order: i }));
}

// Placeholder services so a new booking page isn't empty. The owner edits
// them under Pricing before taking real bookings.
export const STARTER_SERVICES = [
  {
    name: "Maintenance wash",
    description: "Safe hand wash, wheels, glass and a quick interior tidy.",
    duration_mins: 90,
    base_price_pence: 4500,
    size_adjustments: { large: { price_pence: 1000, extra_mins: 15 }, xl: { price_pence: 2000, extra_mins: 30 } },
    sort_order: 1,
  },
  {
    name: "Full valet",
    description: "Deep clean inside and out: vacuum, shampoo, wash, decontaminate and seal.",
    duration_mins: 240,
    base_price_pence: 14000,
    size_adjustments: {
      medium: { price_pence: 1500, extra_mins: 30 },
      large: { price_pence: 3000, extra_mins: 60 },
      xl: { price_pence: 5000, extra_mins: 90 },
    },
    sort_order: 2,
  },
] as const;

export function brandingFor(input: NewBusiness) {
  return {
    primary_color: input.primaryColor,
    accent_color: input.accentColor,
    ...(input.tagline && { tagline: input.tagline }),
  };
}
