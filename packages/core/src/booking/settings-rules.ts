import { z } from "zod";
import { normalizePostcode } from "../customer-fields";
import { DAY_KEYS, weeklyHoursSchema, type ServiceArea, type WeeklyHours } from "./config";
import { isUkPostcode } from "./geo";

// Parsing the booking-settings editor's form posts (Settings → Booking) into
// the rows they update. No database access, so it can be tested. Values come
// in as strings, as a browser sends them.

const DAY_NAMES: Record<(typeof DAY_KEYS)[number], string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

const checkbox = z
  .string()
  .optional()
  .transform((v) => v === "on");

function whole(label: string, min: number, max: number) {
  return z
    .string()
    .trim()
    .refine((v) => /^\d+$/.test(v) && Number(v) >= min && Number(v) <= max, {
      message: `${label} must be a whole number from ${min} to ${max}.`,
    })
    .transform(Number);
}

// "" is fine; anything else must be a full UK postcode.
function postcodeOrBlank(value: string) {
  if (value === "") return { ok: true as const, value: null };
  return isUkPostcode(value) ? { ok: true as const, value: normalizePostcode(value) } : { ok: false as const };
}

const OUTCODE = /^[A-Z]{1,2}\d[A-Z\d]?$/;

// ------------------------------------------------------------------ locations

export const locationsFormSchema = z
  .object({
    offers_mobile: checkbox,
    offers_unit: checkbox,
    base_postcode: z.string().trim(),
    area_type: z.enum(["anywhere", "radius", "districts", "territories"]),
    radius_miles: z.string().trim(),
    districts: z.string().trim(),
    unit_address: z.string().trim().max(300, "Keep the address under 300 characters."),
    unit_postcode: z.string().trim(),
  })
  .transform((v, ctx) => {
    const problem = (path: string, message: string) => {
      ctx.addIssue({ code: "custom", path: [path], message });
      return z.NEVER;
    };

    if (!v.offers_mobile && !v.offers_unit) {
      return problem("offers_mobile", "Offer at least one: jobs at the customer's address, or at your shop.");
    }

    const base = postcodeOrBlank(v.base_postcode);
    if (!base.ok) return problem("base_postcode", "Enter a full UK postcode, like BS1 4DJ.");
    const unit = postcodeOrBlank(v.unit_postcode);
    if (!unit.ok) return problem("unit_postcode", "Enter a full UK postcode, like BS1 4DJ.");

    // Territories are drawn on the Coverage Area page; leave them as they are.
    let service_area: ServiceArea | undefined = {};
    if (v.area_type === "territories") {
      service_area = undefined;
    } else if (v.area_type === "radius") {
      const miles = whole("The distance", 1, 500).safeParse(v.radius_miles);
      if (!miles.success) {
        if (v.offers_mobile) return problem("radius_miles", miles.error.issues[0].message);
      } else {
        if (v.offers_mobile && !base.value) {
          return problem("base_postcode", "Enter where your vans start from, so we can measure the distance.");
        }
        service_area = { radius_miles: miles.data };
      }
    } else if (v.area_type === "districts") {
      const districts = [...new Set(v.districts.toUpperCase().split(/[\s,;]+/).filter(Boolean))];
      const bad = districts.find((d) => !OUTCODE.test(d));
      if (bad) return problem("districts", `"${bad}" isn't a postcode district. Use the first part, like BS1 or BS16.`);
      if (districts.length === 0) {
        if (v.offers_mobile) return problem("districts", "List the postcode districts you cover.");
      } else {
        service_area = { districts };
      }
    }

    if (v.offers_unit) {
      if (!v.unit_address) return problem("unit_address", "Enter your shop's address.");
      if (!unit.value) return problem("unit_postcode", "Enter your shop's postcode.");
    }

    return {
      offers_mobile: v.offers_mobile,
      offers_unit: v.offers_unit,
      base_postcode: base.value,
      ...(service_area && { service_area }),
      unit_address: v.unit_address || null,
      unit_postcode: unit.value,
    };
  });

// ---------------------------------------------------------------------- hours

// Windows within a day, in order, and not overlapping. Days with none are
// closed and left out.
export function tidyHours(hours: WeeklyHours): { hours: WeeklyHours } | { error: string } {
  const out: WeeklyHours = {};
  for (const day of DAY_KEYS) {
    const windows = [...(hours[day] ?? [])].sort((a, b) => a[0].localeCompare(b[0]));
    if (windows.length === 0) continue;
    for (let i = 1; i < windows.length; i++) {
      if (windows[i][0] < windows[i - 1][1]) return { error: `${DAY_NAMES[day]}'s opening times overlap.` };
    }
    out[day] = windows;
  }
  return { hours: out };
}

// The hours editor posts its state as json in one field.
export function parseHours(json: string): { hours: WeeklyHours } | { error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { error: "The opening hours couldn't be read. Reload and try again." };
  }
  const parsed = weeklyHoursSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the opening hours." };
  }
  return tidyHours(parsed.data);
}

export const hoursFormSchema = z
  .object({
    mobile_hours: z.string(),
    shop_different: checkbox,
    shop_hours: z.string().default("{}"),
  })
  .transform((v, ctx) => {
    const mobile = parseHours(v.mobile_hours);
    if ("error" in mobile) {
      ctx.addIssue({ code: "custom", path: ["mobile_hours"], message: mobile.error });
      return z.NEVER;
    }
    let unit_weekly_hours: WeeklyHours | null = null;
    if (v.shop_different) {
      const shop = parseHours(v.shop_hours);
      if ("error" in shop) {
        ctx.addIssue({ code: "custom", path: ["shop_hours"], message: shop.error });
        return z.NEVER;
      }
      unit_weekly_hours = shop.hours;
    }
    return { weekly_hours: mobile.hours, unit_weekly_hours };
  });

// ---------------------------------------------------------------------- rules

export const bookingRulesFormSchema = z
  .object({
    slot_interval_mins: whole("Start times", 5, 240),
    min_notice_hours: whole("Notice", 0, 720),
    max_days_ahead: whole("Booking window", 1, 365),
    travel_buffer_mins: whole("Travel gap", 0, 480),
    unit_buffer_mins: whole("Turnaround", 0, 480),
    hold_minutes: whole("Hold time", 5, 120),
  })
  .transform((v) => v);

// ------------------------------------------------------------------ resources

export const resourceFormSchema = z
  .object({
    name: z.string().trim().min(1, "Give it a name, like Van 2.").max(60, "Keep the name under 60 characters."),
    location_mobile: checkbox,
    location_unit: checkbox,
    custom_hours: checkbox,
    hours: z.string().default("{}"),
    active: checkbox,
    sort_order: z
      .string()
      .trim()
      .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) <= 1000), "Order must be a whole number from 0 to 1000.")
      .transform((v) => (v === "" ? undefined : Number(v))),
  })
  .transform((v, ctx) => {
    if (!v.location_mobile && !v.location_unit) {
      ctx.addIssue({ code: "custom", path: ["location_mobile"], message: "Pick where it works: out on jobs, at the shop, or both." });
      return z.NEVER;
    }
    let weekly_hours: WeeklyHours | null = null;
    if (v.custom_hours) {
      const parsed = parseHours(v.hours);
      if ("error" in parsed) {
        ctx.addIssue({ code: "custom", path: ["hours"], message: parsed.error });
        return z.NEVER;
      }
      if (Object.keys(parsed.hours).length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["hours"],
          message: "Set at least one day it works, or untick \"Its own hours\" to follow the business hours.",
        });
        return z.NEVER;
      }
      weekly_hours = parsed.hours;
    }
    return {
      name: v.name,
      location_types: [v.location_mobile && "mobile", v.location_unit && "unit"].filter(Boolean) as ("mobile" | "unit")[],
      weekly_hours,
      active: v.active,
      sort_order: v.sort_order,
    };
  });
