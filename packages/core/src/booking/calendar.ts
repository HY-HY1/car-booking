// Helpers behind the booking form's date and time picker. Dates are calendar
// dates ("2026-10-16") with no time zone, so nothing here uses the browser's
// local zone: a customer's phone can't shift a day.

const pad = (n: number) => String(n).padStart(2, "0");

export function monthOf(date: string) {
  return date.slice(0, 7);
}

export function addMonths(month: string, by: number) {
  const [y, m] = month.split("-").map(Number);
  const index = y * 12 + (m - 1) + by;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
}

// Every month from `first` to `last` inclusive, as "YYYY-MM".
export function monthsBetween(first: string, last: string) {
  const out: string[] = [];
  for (let m = monthOf(first); m <= monthOf(last) && out.length < 36; m = addMonths(m, 1)) out.push(m);
  return out;
}

const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

// 0 = Monday ... 6 = Sunday, for the first of a month.
function mondayIndex(y: number, m: number) {
  return (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
}

// Weeks (Monday first) of a month; null pads the days that belong to the
// neighbouring months.
export function monthGrid(month: string): (string | null)[][] {
  const [y, m] = month.split("-").map(Number);
  const cells: (string | null)[] = Array(mondayIndex(y, m)).fill(null);
  for (let d = 1; d <= daysIn(y, m); d++) cells.push(`${month}-${pad(d)}`);
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export const WEEKDAY_HEADINGS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const format = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));

export const monthTitle = (month: string) => format(`${month}-01`, { month: "long", year: "numeric" });
export const longDate = (date: string) => format(date, { weekday: "long", day: "numeric", month: "long" });
export const shortDate = (date: string) => format(date, { weekday: "short", day: "numeric", month: "short" });

export type TimeOfDay = "Morning" | "Afternoon" | "Evening";

// Start times split the way people think about a day. `time` is "HH:MM" in
// the business's own zone.
export function groupByTimeOfDay<T extends { time: string }>(slots: T[]) {
  const groups: Record<TimeOfDay, T[]> = { Morning: [], Afternoon: [], Evening: [] };
  for (const slot of slots) {
    const hour = Number(slot.time.slice(0, 2));
    groups[hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening"].push(slot);
  }
  return (Object.entries(groups) as [TimeOfDay, T[]][]).filter(([, list]) => list.length > 0);
}
