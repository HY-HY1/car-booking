import { hoursFor, resourcesFor, type BookingSettings, type LocationType, type Resource, type WeeklyHours } from "./config";

// The longest job a business can take in one go, for each kind of job: a
// job has to fit inside one opening window (it can't run across a lunch
// break or overnight, availability.ts), so it's the longest single window
// any van, bay or person doing that kind of job has in the week. The
// booking form uses it to say straight away when the cars someone has
// picked take too long for one visit, instead of showing no free days.

const minutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
};

// The longest single window in a week of hours, in minutes; 0 with none.
export function longestWindow(hours: WeeklyHours) {
  let longest = 0;
  for (const windows of Object.values(hours)) {
    for (const [open, close] of windows ?? []) longest = Math.max(longest, minutes(close) - minutes(open));
  }
  return longest;
}

// Null when nothing does that kind of job (so there's nothing to compare).
export function longestJobMins(
  settings: Pick<BookingSettings, "weekly_hours" | "unit_weekly_hours">,
  resources: Pick<Resource, "weekly_hours" | "location_types" | "sort_order">[],
  locationType: LocationType,
): number | null {
  const doers = resourcesFor(resources, locationType);
  if (!doers.length) return null;
  return Math.max(...doers.map((r) => longestWindow(hoursFor(settings, r, locationType))));
}
