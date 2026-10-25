import { z } from "zod";

// Shapes of the booking config rows, including the json columns the database
// can't check. Parsing every row through these means a typo in one tenant's
// config fails loudly instead of producing a wrong price.

export const SIZE_CLASSES = {
  small: "Small: Fiesta, Polo, Corsa",
  medium: "Medium: Golf, Focus, A3",
  large: "Large: estates, SUVs, Tesla Model Y",
  xl: "XL: 7-seaters, pickups, vans",
} as const;

export type SizeClass = keyof typeof SIZE_CLASSES;
export const sizeClassSchema = z.enum(Object.keys(SIZE_CLASSES) as [SizeClass]);

export const LOCATION_TYPES = {
  mobile: "At my address",
  unit: "I'll drop it off",
} as const;

export type LocationType = keyof typeof LOCATION_TYPES;
export const locationTypeSchema = z.enum(["mobile", "unit"]);

export const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");

export const weeklyHoursSchema = z.partialRecord(
  z.enum(DAY_KEYS),
  z.array(
    z.tuple([clockTime, clockTime]).refine(([open, close]) => open < close, {
      message: "Opening time must be before closing time",
    }),
  ),
);
export type WeeklyHours = z.infer<typeof weeklyHoursSchema>;

// A circle on the map. Several can be set (a crew in each town), and a job is
// in the area if it falls inside any of them. The first is the default.
export const territorySchema = z.object({
  id: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1, "Give every territory a name.").max(60, "Keep names under 60 characters."),
  lat: z.number().min(49).max(61),
  lng: z.number().min(-9).max(3),
  radius_miles: z.number().int().min(1, "At least 1 mile.").max(500, "500 miles at most."),
});
export type Territory = z.infer<typeof territorySchema>;
export const MAX_TERRITORIES = 10;

export const territoriesSchema = z
  .array(territorySchema)
  .min(1, "Keep at least one territory.")
  .max(MAX_TERRITORIES, `${MAX_TERRITORIES} territories at most.`);

export const serviceAreaSchema = z.union([
  z.object({ territories: territoriesSchema }),
  z.object({ districts: z.array(z.string().trim().toUpperCase()).min(1) }),
  z.object({ radius_miles: z.number().positive() }),
  z.object({}).strict(),
]);
export type ServiceArea = z.infer<typeof serviceAreaSchema>;

export const depositSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({ type: z.literal("percent"), value: z.number().min(0).max(100) }),
  z.object({ type: z.literal("fixed"), value_pence: z.number().int().min(0) }),
  // The whole price is paid when booking.
  z.object({ type: z.literal("full") }),
]);
export type DepositRule = z.infer<typeof depositSchema>;

export const conditionTierSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  multiplier: z.number().min(0).default(1),
  extra_mins: z.number().int().min(0).default(0),
  // The price can't be known from photos or a description: book it at the
  // base price and flag it for the owner to confirm.
  needs_inspection: z.boolean().default(false),
});
export type ConditionTier = z.infer<typeof conditionTierSchema>;

export const bookingSettingsSchema = z.object({
  tenant_id: z.uuid(),
  timezone: z.string(),
  weekly_hours: weeklyHoursSchema,
  slot_interval_mins: z.number().int(),
  min_notice_hours: z.number().int(),
  max_days_ahead: z.number().int(),
  travel_buffer_mins: z.number().int(),
  hold_minutes: z.number().int(),
  offers_mobile: z.boolean(),
  offers_unit: z.boolean(),
  unit_address: z.string().nullable(),
  unit_postcode: z.string().nullable(),
  base_postcode: z.string().nullable(),
  service_area: serviceAreaSchema,
  deposit: depositSchema,
  min_price_pence: z.number().int(),
  mobile_surcharge_pence: z.number().int(),
  condition_tiers: z.array(conditionTierSchema),
  // The shop's own hours; null = the same as mobile (weekly_hours).
  unit_weekly_hours: weeklyHoursSchema.nullable(),
  // Gap between two shop jobs (no travelling, but a bay to turn round).
  unit_buffer_mins: z.number().int(),
  // Bookings can't be made without at least min_photos photos of the car.
  photos_required: z.boolean().default(false),
  min_photos: z.number().int().default(1),
  // Which optional questions are asked: settings/questions.ts.
  questions: z.unknown().default({}),
  // 'manual': bookings wait as 'requested' until the owner approves them.
  approval_mode: z.enum(["auto", "manual"]).default("auto"),
  // Cut-offs and refunds: settings/policy.ts. {} = none set.
  cancellation_policy: z.unknown().default({}),
});
export type BookingSettings = z.infer<typeof bookingSettingsSchema>;

// A van, a bay, or a person who does both: one thing that does one job at a
// time. See supabase/migrations/20261018120000_resources.sql.
export const resourceSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  location_types: z.array(locationTypeSchema).min(1),
  weekly_hours: weeklyHoursSchema.nullable(),
  sort_order: z.number().int(),
});
export type Resource = z.infer<typeof resourceSchema>;

type HoursSettings = Pick<BookingSettings, "weekly_hours" | "unit_weekly_hours">;

// When this resource takes this kind of job: its own hours if it has them,
// otherwise the business's hours for mobile or for the shop.
export function hoursFor(
  settings: HoursSettings,
  resource: Pick<Resource, "weekly_hours">,
  locationType: LocationType,
): WeeklyHours {
  if (resource.weekly_hours) return resource.weekly_hours;
  return locationType === "unit" ? (settings.unit_weekly_hours ?? settings.weekly_hours) : settings.weekly_hours;
}

// The gap kept between a job and the next one on the same resource. Two shop
// jobs need a turnaround; anything involving travel needs the travel buffer.
export function bufferFor(
  settings: Pick<BookingSettings, "travel_buffer_mins" | "unit_buffer_mins">,
  a: LocationType,
  b: LocationType,
) {
  return a === "unit" && b === "unit" ? settings.unit_buffer_mins : settings.travel_buffer_mins;
}

// The resources that can take a kind of job, in the order they're filled.
export function resourcesFor<T extends Pick<Resource, "location_types" | "sort_order">>(
  resources: T[],
  locationType: LocationType,
) {
  return resources.filter((r) => r.location_types.includes(locationType)).sort((a, b) => a.sort_order - b.sort_order);
}

const sizeAdjustmentSchema = z.object({
  price_pence: z.number().int().min(0).default(0),
  extra_mins: z.number().int().min(0).default(0),
});

export const serviceSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  duration_mins: z.number().int(),
  base_price_pence: z.number().int(),
  size_adjustments: z.partialRecord(sizeClassSchema, sizeAdjustmentSchema),
  location_types: z.array(locationTypeSchema),
  // Website content; optional so pricing code and tests don't need it.
  tagline: z.string().nullable().optional(),
  includes: z.array(z.string()).optional(),
  image_path: z.string().nullable().optional(),
  slug: z.string().nullable().optional(),
  badge: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  not_included: z.array(z.string()).optional(),
  gallery: z.array(z.string()).optional(),
  steps: z.array(z.object({ title: z.string(), text: z.string() })).optional(),
  faqs: z.array(z.object({ q: z.string(), a: z.string() })).optional(),
  seo_title: z.string().nullable().optional(),
  seo_description: z.string().nullable().optional(),
});
export type Service = z.infer<typeof serviceSchema>;

export const addOnSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  price_pence: z.number().int(),
  duration_mins: z.number().int(),
  service_ids: z.array(z.uuid()).nullable(),
});
export type AddOn = z.infer<typeof addOnSchema>;

export function addOnFitsService(addOn: AddOn, serviceId: string) {
  return addOn.service_ids === null || addOn.service_ids.includes(serviceId);
}

export function formatPence(pence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: pence % 100 === 0 ? 0 : 2,
  }).format(pence / 100);
}

export function formatDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m} min`;
  return m ? `${h} hr ${m} min` : `${h} hr${h > 1 ? "s" : ""}`;
}
