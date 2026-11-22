import { addDays } from "./time";

// The booking page's "next available" strip: the next day a job still fits,
// and how the coming week looks. Pure: the engine works out which days have
// time free (nextAvailability in engine.ts) and passes them in.

// open: a job still fits. full: a working day with no time left. closed: not a working day.
export type DayStatus = "open" | "full" | "closed";
export type StripDay = { date: string; status: DayStatus };

export type NextAvailability = {
  today: string;
  // The first day with time free in the whole booking window; null = fully booked.
  next: string | null;
  // The coming days, today first.
  days: StripDay[];
};

export function availabilityStrip(input: {
  today: string;
  // Days the business works within the booking window.
  workingDays: string[];
  // Of those, the days with time free.
  openDays: string[];
  length?: number;
}): NextAvailability {
  const { today, length = 7 } = input;
  const working = new Set(input.workingDays);
  const open = new Set(input.openDays);
  const days: StripDay[] = [];
  for (let i = 0; i < length; i++) {
    const date = addDays(today, i);
    days.push({ date, status: open.has(date) ? "open" : working.has(date) ? "full" : "closed" });
  }
  const next = [...open].filter((d) => d >= today).sort()[0] ?? null;
  return { today, next, days };
}

const fmt = (date: string, options: Intl.DateTimeFormatOptions) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
};

// "Today", "Tomorrow", "Thursday" this week, "Tuesday 2 December" further off.
export function dayLabel(date: string, today: string) {
  if (date === today) return "Today";
  if (date === addDays(today, 1)) return "Tomorrow";
  if (date < addDays(today, 7)) return fmt(date, { weekday: "long" });
  return fmt(date, { weekday: "long", day: "numeric", month: "long" });
}

// "Thu" and "27": the two lines of a day in the strip.
export function stripDay(date: string) {
  return { weekday: fmt(date, { weekday: "short" }), day: fmt(date, { day: "numeric" }), full: fmt(date, { weekday: "long", day: "numeric", month: "long" }) };
}
