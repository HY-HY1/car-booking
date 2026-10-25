import { estimateDriveMins, haversineMiles, type Coords } from "./geo";
import { addDays, isIsoDate, localDate, localTime, weekday, zonedTimeToUtc } from "./time";
import { hoursFor, type BookingSettings, type LocationType, type Resource, type WeeklyHours } from "./config";

// The owner's diary: which days a view covers, where things sit on a day's
// grid, and the drive between one job and the next. Pure, so the page only
// loads data and draws it. Dates are tenant-local "YYYY-MM-DD".

export const DIARY_VIEWS = ["day", "week"] as const;
export type DiaryView = (typeof DIARY_VIEWS)[number];

export function parseView(value: unknown): DiaryView {
  return (DIARY_VIEWS as readonly unknown[]).includes(value) ? (value as DiaryView) : "week";
}

// A date from the address bar; anything odd (or absurdly far off) is today.
export function parseDiaryDate(value: unknown, today: string): string {
  if (typeof value !== "string" || !isIsoDate(value)) return today;
  const year = Number(value.slice(0, 4));
  return year >= 2000 && year <= 2100 ? value : today;
}

// Monday to Sunday around `date`, or just the day.
export function diaryDays(view: DiaryView, date: string): string[] {
  if (view === "day") return [date];
  const sinceMonday = (["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const).indexOf(
    weekday(date) as "mon",
  );
  const monday = addDays(date, -sinceMonday);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function stepDate(view: DiaryView, date: string, direction: 1 | -1) {
  return addDays(date, (view === "week" ? 7 : 1) * direction);
}

// The instants a run of days covers, midnight to midnight in the zone.
export function diaryRange(days: string[], timeZone: string) {
  return {
    start: zonedTimeToUtc(days[0], "00:00", timeZone),
    end: zonedTimeToUtc(addDays(days[days.length - 1], 1), "00:00", timeZone),
  };
}

// ------------------------------------------------------------------ the grid

// Minutes since local midnight on `date` for an instant, clamped to that day
// (an overnight block starts at 0 on its second day and ends at 1440 on its
// first). Read off the wall clock, so a clock-change day still lines up with
// the hour labels.
export function minuteOfDay(instant: Date, date: string, timeZone: string) {
  const day = localDate(instant, timeZone);
  if (day < date) return 0;
  if (day > date) return 24 * 60;
  const [h, m] = localTime(instant, timeZone).split(":").map(Number);
  return h * 60 + m;
}

export type Placed = { start: number; end: number };

// Where an item with these instants sits on one day's grid, or null when it
// doesn't touch the day.
export function placeOnDay(start: Date, end: Date, date: string, timeZone: string): Placed | null {
  const s = minuteOfDay(start, date, timeZone);
  const e = minuteOfDay(end, date, timeZone);
  return e > s ? { start: s, end: e } : null;
}

// Side-by-side lanes for items that overlap in time (a job and a block of
// time off, say). Items that don't overlap anything get the full width.
export function assignLanes<T extends Placed>(items: T[]): (T & { lane: number; lanes: number })[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: (T & { lane: number; lanes: number })[] = [];

  let cluster: (T & { lane: number; lanes: number })[] = [];
  let clusterEnd = -Infinity;
  const laneEnds: number[] = [];

  const flush = () => {
    for (const item of cluster) item.lanes = laneEnds.length;
    out.push(...cluster);
    cluster = [];
    laneEnds.length = 0;
  };

  for (const item of sorted) {
    if (item.start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= item.start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = item.end;
    cluster.push({ ...item, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  flush();
  return out;
}

// The hours a view shows: the working day across the days in view, widened to
// take in anything outside it, so nothing is ever clipped off the grid.
export function visibleHours(
  days: string[],
  weeklyHours: WeeklyHours,
  placed: Placed[],
): { from: number; to: number } {
  let from = 24 * 60;
  let to = 0;
  for (const day of days) {
    for (const [open, close] of weeklyHours[weekday(day)] ?? []) {
      from = Math.min(from, toMinutes(open));
      to = Math.max(to, toMinutes(close));
    }
  }
  for (const p of placed) {
    from = Math.min(from, p.start);
    to = Math.max(to, p.end);
  }
  if (to <= from) return { from: 8 * 60, to: 18 * 60 };
  // Whole hours, with an hour of room either side of the working day.
  return {
    from: Math.max(0, Math.floor(from / 60) * 60 - 60),
    to: Math.min(24 * 60, Math.ceil(to / 60) * 60 + 60),
  };
}

export function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

// ----------------------------------------------------------------- travel

export type DiaryJob = { id: string; start: Date; end: Date; postcode: string; locationType?: LocationType };

export type TravelLeg = {
  fromId: string;
  toId: string;
  // The empty time between the two jobs.
  start: Date;
  end: Date;
  gapMins: number;
  // Estimated drive, or null when a postcode couldn't be placed.
  driveMins: number | null;
  // What the booking engine would insist on between these two jobs.
  requiredMins: number;
  // Less time than that: the owner may be late to the second job.
  tight: boolean;
};

const MINUTE = 60_000;

// The gap after each job to the next one, with the estimated drive. Uses the
// engine's own rule (the larger of the tenant's buffer and the drive) so the
// diary and the booking page agree. Gaps longer than `maxGapMins` are left
// out: that's a break or a trip home, not travel.
export function travelLegs(
  jobs: DiaryJob[],
  coordsOf: (postcode: string) => Coords | undefined,
  // A number, or a rule for a pair of jobs (shop jobs turn round faster).
  bufferMins: number | ((from: DiaryJob, to: DiaryJob) => number),
  maxGapMins = 180,
): TravelLeg[] {
  const sorted = [...jobs].sort((a, b) => a.start.getTime() - b.start.getTime());
  const legs: TravelLeg[] = [];

  for (let i = 0; i + 1 < sorted.length; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const gapMins = Math.round((b.start.getTime() - a.end.getTime()) / MINUTE);
    if (gapMins < 0 || gapMins > maxGapMins) continue;

    const here = coordsOf(a.postcode);
    const there = coordsOf(b.postcode);
    const driveMins =
      a.postcode.replace(/\s/g, "") === b.postcode.replace(/\s/g, "")
        ? 0
        : here && there
          ? estimateDriveMins(haversineMiles(here, there))
          : null;
    const requiredMins = Math.max(typeof bufferMins === "function" ? bufferMins(a, b) : bufferMins, driveMins ?? 0);

    legs.push({
      fromId: a.id,
      toId: b.id,
      start: a.end,
      end: b.start,
      gapMins,
      driveMins,
      requiredMins,
      tight: gapMins < requiredMins,
    });
  }
  return legs;
}

// ----------------------------------------------------------------- statuses

export type BookingStatus = "held" | "requested" | "confirmed" | "completed" | "cancelled" | "no_show" | "expired";

// What the owner can change a booking to from the diary. Completing, a
// no-show or a cancellation can each be undone; getting there from a held
// slot is only by paying, so a hold can only be dropped. A request is
// approved or declined on its own (booking/approval.ts), as declining
// refunds the deposit.
export function allowedStatusChanges(status: string): BookingStatus[] {
  switch (status) {
    case "held":
      return ["cancelled"];
    case "confirmed":
      return ["completed", "no_show", "cancelled"];
    case "completed":
    case "no_show":
    case "cancelled":
      return ["confirmed"];
    default:
      return [];
  }
}

// Statuses that take a place in the diary. Cancelled jobs and lapsed holds
// don't.
export const DIARY_STATUSES = ["held", "requested", "confirmed", "completed", "no_show"] as const;

// ---------------------------------------------------------------- resources

// All the opening windows of several sets of hours, day by day. For shading a
// diary column that stands for more than one van.
export function unionHours(sets: WeeklyHours[]): WeeklyHours {
  const out: WeeklyHours = {};
  for (const set of sets) {
    for (const [day, windows] of Object.entries(set) as [keyof WeeklyHours, [string, string][]][]) {
      if (windows?.length) out[day] = [...(out[day] ?? []), ...windows];
    }
  }
  return out;
}

// When one van or bay is working: its own hours, or the business's for each
// kind of job it does.
export function resourceHours(
  settings: Pick<BookingSettings, "weekly_hours" | "unit_weekly_hours">,
  resource: Pick<Resource, "weekly_hours" | "location_types">,
): WeeklyHours {
  if (resource.weekly_hours) return resource.weekly_hours;
  return unionHours(resource.location_types.map((t) => hoursFor(settings, resource, t)));
}
