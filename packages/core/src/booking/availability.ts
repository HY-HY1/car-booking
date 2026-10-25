import type { BookingSettings } from "./config";
import { addDays, localDate, weekday, zonedTimeToUtc } from "./time";

// check_availability: the start times on one day that fit a job of a given
// length around existing jobs, blocked time and travel. Pure: the engine
// loads the day's bookings and travel estimates and passes them in.

export type AvailabilitySettings = Pick<
  BookingSettings,
  | "timezone"
  | "weekly_hours"
  | "slot_interval_mins"
  | "min_notice_hours"
  | "max_days_ahead"
  | "travel_buffer_mins"
>;

export type BusyPeriod =
  // Another job. travelMins is the estimated drive between that job and the
  // new one; the gap kept is the larger of that and the tenant's buffer.
  // bufferMins replaces the tenant's travel buffer for this pair of jobs
  // (two shop jobs need a turnaround, not a travel gap).
  | { kind: "job"; start: Date; end: Date; travelMins?: number; bufferMins?: number }
  // Owner's blocked time: no travel gap needed.
  | { kind: "blocked"; start: Date; end: Date };

export type SlotQuery = {
  date: string; // tenant-local "YYYY-MM-DD"
  durationMins: number;
  settings: AvailabilitySettings;
  busy: BusyPeriod[];
  now: Date;
};

const MINUTE = 60_000;

// The tenant-local dates a customer can pick from, today first.
export function bookableDates(
  settings: AvailabilitySettings,
  now: Date,
  // Several sets of hours (one per van or bay): a day counts if any is open.
  hours: AvailabilitySettings["weekly_hours"][] = [settings.weekly_hours],
): string[] {
  const today = localDate(now, settings.timezone);
  const dates: string[] = [];
  for (let i = 0; i <= settings.max_days_ahead; i++) {
    const date = addDays(today, i);
    if (hours.some((h) => h[weekday(date)]?.length)) dates.push(date);
  }
  return dates;
}

export function availableSlots({ date, durationMins, settings, busy, now }: SlotQuery): Date[] {
  const today = localDate(now, settings.timezone);
  if (date < today || date > addDays(today, settings.max_days_ahead)) return [];

  const earliest = now.getTime() + settings.min_notice_hours * 60 * MINUTE;
  const step = settings.slot_interval_mins * MINUTE;
  const length = durationMins * MINUTE;
  const slots: Date[] = [];

  for (const [open, close] of settings.weekly_hours[weekday(date)] ?? []) {
    const windowStart = zonedTimeToUtc(date, open, settings.timezone).getTime();
    const windowEnd = zonedTimeToUtc(date, close, settings.timezone).getTime();

    for (let start = windowStart; start + length <= windowEnd; start += step) {
      if (start < earliest) continue;
      const end = start + length;
      const clash = busy.some((b) => {
        const gap =
          b.kind === "job"
            ? Math.max(b.bufferMins ?? settings.travel_buffer_mins, b.travelMins ?? 0) * MINUTE
            : 0;
        return start < b.end.getTime() + gap && end + gap > b.start.getTime();
      });
      if (!clash) slots.push(new Date(start));
    }
  }
  return slots;
}

// The UTC range to load bookings for when checking one local day: the day
// itself, widened so jobs just either side still count for travel gaps.
export function dayRange(date: string, timeZone: string) {
  return {
    from: new Date(zonedTimeToUtc(date, "00:00", timeZone).getTime() - 12 * 60 * MINUTE),
    to: new Date(zonedTimeToUtc(addDays(date, 1), "00:00", timeZone).getTime() + 12 * 60 * MINUTE),
  };
}
