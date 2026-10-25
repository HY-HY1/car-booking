import { DAY_KEYS, type DayKey } from "./config";

// Time zone helpers without a date library. Opening hours are stored as wall
// clock times in the tenant's zone ("08:00" in Europe/London); bookings are
// stored in UTC. These convert between the two, across BST changes.

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string) {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

function zonedParts(date: Date, timeZone: string) {
  const parts: Record<string, number> = {};
  for (const p of formatter(timeZone).formatToParts(date)) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  return parts as Record<"year" | "month" | "day" | "hour" | "minute" | "second", number>;
}

// How far the zone is ahead of UTC at that instant, in ms (BST = +3,600,000).
function offsetMs(utcMs: number, timeZone: string) {
  const p = zonedParts(new Date(utcMs), timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

// "2026-10-25", "08:00", "Europe/London" → the UTC instant of that wall time.
// Times skipped by a clock change resolve to the hour after.
export function zonedTimeToUtc(date: string, time: string, timeZone: string): Date {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  const first = naive - offsetMs(naive, timeZone);
  const second = naive - offsetMs(first, timeZone);
  return new Date(second);
}

// The tenant-local calendar date of an instant, as "YYYY-MM-DD".
export function localDate(instant: Date, timeZone: string): string {
  const p = zonedParts(instant, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

// The tenant-local clock time of an instant, as "HH:MM".
export function localTime(instant: Date, timeZone: string): string {
  const p = zonedParts(instant, timeZone);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

export function weekday(date: string): DayKey {
  const [y, m, d] = date.split("-").map(Number);
  return DAY_KEYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && addDays(value, 0) === value;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}
