import { availableSlots, bookableDates, type AvailabilitySettings, type BusyPeriod } from "./availability";
import { hoursFor, resourcesFor, type BookingSettings, type LocationType, type Resource } from "./config";

// Availability across several vans and bays. Each resource does one job at a
// time with its own hours and its own jobs around it; a start time is on offer
// if at least one suitable resource is free for it. Pure: the engine loads
// each resource's busy periods and passes them in.

export type CapacitySettings = AvailabilitySettings & Pick<BookingSettings, "unit_weekly_hours">;
export type CapacityResource = Pick<Resource, "id" | "location_types" | "weekly_hours" | "sort_order">;

export type SlotOffer = {
  start: Date;
  // Every resource free for this start, in the order they're filled. The
  // booking goes to the first; the rest are fallbacks if it's taken meanwhile.
  resourceIds: string[];
};

export function openSlots(query: {
  date: string;
  durationMins: number;
  locationType: LocationType;
  settings: CapacitySettings;
  resources: CapacityResource[];
  // Jobs and blocked time per resource (blocked time for the whole business
  // is in every resource's list).
  busyByResource: Map<string, BusyPeriod[]>;
  now: Date;
}): SlotOffer[] {
  const { date, durationMins, locationType, settings, resources, busyByResource, now } = query;
  const byStart = new Map<number, string[]>();

  for (const resource of resourcesFor(resources, locationType)) {
    const slots = availableSlots({
      date,
      durationMins,
      settings: { ...settings, weekly_hours: hoursFor(settings, resource, locationType) },
      busy: busyByResource.get(resource.id) ?? [],
      now,
    });
    for (const slot of slots) {
      const ids = byStart.get(slot.getTime());
      if (ids) ids.push(resource.id);
      else byStart.set(slot.getTime(), [resource.id]);
    }
  }

  return [...byStart.entries()]
    .sort(([a], [b]) => a - b)
    .map(([start, resourceIds]) => ({ start: new Date(start), resourceIds }));
}

// The dates worth checking for a kind of job: any day at least one suitable
// resource is open.
export function bookableDatesFor(
  settings: CapacitySettings,
  resources: CapacityResource[],
  locationType: LocationType,
  now: Date,
) {
  return bookableDates(
    settings,
    now,
    resourcesFor(resources, locationType).map((r) => hoursFor(settings, r, locationType)),
  );
}

// Every date any kind of job could be booked, for the page's first load before
// the customer has said which they want.
export function bookableDatesForAny(
  settings: CapacitySettings,
  resources: CapacityResource[],
  locationTypes: LocationType[],
  now: Date,
) {
  const dates = new Set(locationTypes.flatMap((t) => bookableDatesFor(settings, resources, t, now)));
  return [...dates].sort();
}

// ------------------------------------------------------------------ summary

export type CapacitySummary = {
  // Jobs that can run at the same time, by kind, counting only what's switched
  // on and has a van or bay to do it.
  mobile: number;
  unit: number;
  warnings: string[];
};

// What the business can actually take, and what's stopping it, for the top of
// Settings → Booking.
export function summariseCapacity(
  settings: Pick<BookingSettings, "offers_mobile" | "offers_unit" | "weekly_hours" | "unit_weekly_hours">,
  resources: (CapacityResource & { name: string; active: boolean })[],
): CapacitySummary {
  const active = resources.filter((r) => r.active);
  const warnings: string[] = [];
  const count = { mobile: 0, unit: 0 };

  for (const [type, on, label, place] of [
    ["mobile", settings.offers_mobile, "Mobile jobs", "mobile"],
    ["unit", settings.offers_unit, "Shop jobs", "shop"],
  ] as const) {
    const doers = resourcesFor(active, type);
    if (!on) {
      if (doers.length > 0) {
        warnings.push(`${label} are switched off, so ${doers.map((r) => r.name).join(", ")} won't be used for ${place} work.`);
      }
      continue;
    }
    if (doers.length === 0) {
      warnings.push(`${label} are switched on, but no van or bay is taking ${place} bookings, so customers can't book them. Add one, or switch one on.`);
      continue;
    }
    count[type] = doers.length;
    if (!doers.some((r) => Object.values(hoursFor(settings, r, type)).some((windows) => windows?.length))) {
      warnings.push(`No opening hours are set for ${place} jobs, so nothing can be booked.`);
    }
  }
  return { ...count, warnings };
}
