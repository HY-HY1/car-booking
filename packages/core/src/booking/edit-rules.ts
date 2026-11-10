import { z } from "zod";
import { normalizePostcode } from "../customer-fields";
import { sizeClassSchema } from "./config";
import { isUkPostcode } from "./geo";
import { addDays } from "./time";

// Changing a booking after it's made, and making it repeat. No database
// access, so it can be tested. Values come in as strings from the browser.

// A job can be changed until it's over; a cancelled one is put back first.
export const EDITABLE_STATUSES = ["confirmed", "requested"] as const;
export const canEditBooking = (status: string) => (EDITABLE_STATUSES as readonly string[]).includes(status);

const uuidOrBlank = (message: string) =>
  z
    .string()
    .trim()
    .default("")
    .refine((v) => v === "" || z.uuid().safeParse(v).success, message)
    .transform((v) => v || null);

const pounds = (label: string) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(/^£/, ""))
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v) && Number(v) <= 100_000, `Enter ${label} in pounds, like 25 or 12.50.`)
    .transform((v) => Math.round(Number(v) * 100));

const minutes = (label: string, min: number) =>
  z
    .string()
    .trim()
    .refine((v) => /^\d+$/.test(v) && Number(v) >= min && Number(v) <= 1440, `${label} must be from ${min} to 1440 minutes.`)
    .transform(Number);

export const editBookingFormSchema = z
  .object({
    service_id: z.uuid("Pick a service."),
    size_class: sizeClassSchema,
    add_on_ids: z.string().default(""),
    address_line: z.string().trim().max(300, "Keep the address under 300 characters.").default(""),
    postcode: z.string().trim().default(""),
    resource_id: z.uuid("Pick a van or bay."),
    staff_id: uuidOrBlank("Pick someone from the list."),
    price: pounds("the price"),
    duration_mins: minutes("The length", 15),
    // Ticked: forget the two boxes above and use the price list.
    recalculate: z
      .string()
      .optional()
      .transform((v) => v === "on"),
  })
  .transform((v, ctx) => {
    const addOnIds = v.add_on_ids.split(",").map((s) => s.trim()).filter(Boolean);
    if (addOnIds.some((id) => !z.uuid().safeParse(id).success)) {
      ctx.addIssue({ code: "custom", path: ["add_on_ids"], message: "Pick the extras again." });
      return z.NEVER;
    }
    return {
      serviceId: v.service_id,
      sizeClass: v.size_class,
      addOnIds,
      addressLine: v.address_line || null,
      postcode: v.postcode,
      resourceId: v.resource_id,
      staffId: v.staff_id,
      pricePence: v.recalculate ? null : v.price,
      durationMins: v.recalculate ? null : v.duration_mins,
    };
  });
export type EditBooking = z.output<typeof editBookingFormSchema>;

// A mobile job needs a real postcode; a job at the unit keeps the unit's.
export function editedPostcode(locationType: "mobile" | "unit", input: string, current: string) {
  if (locationType === "unit") return current;
  return isUkPostcode(input) ? normalizePostcode(input) : null;
}

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .default("")
    .transform((v) => v || null);

export const extraCarFormSchema = z.object({
  make: optional(60),
  model: optional(60),
  registration: optional(10).transform((v) => v?.replace(/\s/g, "").toUpperCase() || null),
  size_class: z.union([z.literal("").transform(() => null), sizeClassSchema]).default(null),
  price: pounds("the price"),
  extra_mins: z
    .string()
    .trim()
    .default("0")
    .refine((v) => /^\d+$/.test(v) && Number(v) <= 1440, "Enter the extra minutes this car adds.")
    .transform(Number),
}).refine((c) => c.make || c.model || c.registration, { path: ["make"], message: "Say which car it is." });

export const extraCarLabel = (c: { make: string | null; model: string | null; registration: string | null }) =>
  `Extra car: ${[c.make, c.model].filter(Boolean).join(" ") || c.registration}`;

// ---------------------------------------------------------------- repeats

export const MAX_REPEATS = 26;

// The dates after the first, for "every N weeks, M times in all". Dates, not
// instants, so 9am stays 9am either side of the clocks changing.
export function repeatDates(firstDate: string, everyWeeks: number, totalTimes: number) {
  return Array.from({ length: Math.max(totalTimes - 1, 0) }, (_, i) => addDays(firstDate, everyWeeks * 7 * (i + 1)));
}
