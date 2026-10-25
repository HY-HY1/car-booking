import { addDays, localDate, localTime, weekday, zonedTimeToUtc } from "../booking/time";

// The calendar periods the overview shows (day, week, month, year), worked out
// in the business's own time zone: "today" for a detailer in London is not the
// same instant as for a server in UTC, and a day is 23 or 25 hours long when
// the clocks change. Weeks run Monday to Sunday.

export const PERIODS = ["day", "week", "month", "year"] as const;
export type Period = (typeof PERIODS)[number];

export type Bucket = {
  start: Date;
  end: Date;
  // Short axis label, and the fuller one for tooltips and the table.
  label: string;
  fullLabel: string;
};

export type PeriodRange = {
  period: Period;
  // 0 = the current period, 1 = the one before, and so on.
  offset: number;
  start: Date;
  end: Date;
  label: string;
  buckets: Bucket[];
  // What it's compared with: the period before, up to the same point in it
  // while this one is still in progress, so a half-finished month isn't
  // measured against a whole one.
  compareStart: Date;
  compareEnd: Date;
  compareLabel: string;
  // The whole previous period, for figures that include the future part of
  // this one (jobs booked for later this week), where "up to the same point"
  // would compare unlike with unlike.
  previousEnd: Date;
  previousLabel: string;
  inProgress: boolean;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pad = (n: number) => String(n).padStart(2, "0");

function parts(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d };
}

const fmt = (timeZone: string, options: Intl.DateTimeFormatOptions, instant: Date) =>
  new Intl.DateTimeFormat("en-GB", { timeZone, ...options }).format(instant);

// First calendar date of the period `offset` periods back, as YYYY-MM-DD.
function startDateOf(period: Period, today: string, offset: number) {
  if (period === "day") return addDays(today, -offset);
  if (period === "week") {
    const sinceMonday = (["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const).indexOf(
      weekday(today) as "mon",
    );
    return addDays(today, -sinceMonday - 7 * offset);
  }
  const { y, m } = parts(today);
  if (period === "month") {
    const index = y * 12 + (m - 1) - offset;
    return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}-01`;
  }
  return `${y - offset}-01-01`;
}

function nextStartDate(period: Period, start: string) {
  if (period === "day") return addDays(start, 1);
  if (period === "week") return addDays(start, 7);
  const { y, m } = parts(start);
  if (period === "month") return m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`;
  return `${y + 1}-01-01`;
}

const atMidnight = (date: string, timeZone: string) => zonedTimeToUtc(date, "00:00", timeZone);

function labelFor(period: Period, offset: number, start: Date, end: Date, timeZone: string) {
  if (period === "day") {
    if (offset === 0) return "Today";
    if (offset === 1) return "Yesterday";
    return fmt(timeZone, { weekday: "short", day: "numeric", month: "short", year: "numeric" }, start);
  }
  if (period === "week") {
    if (offset === 0) return "This week";
    if (offset === 1) return "Last week";
    const last = new Date(end.getTime() - 1);
    return `${fmt(timeZone, { day: "numeric", month: "short" }, start)} to ${fmt(timeZone, { day: "numeric", month: "short", year: "numeric" }, last)}`;
  }
  if (period === "month") return offset === 0 ? "This month" : fmt(timeZone, { month: "long", year: "numeric" }, start);
  return offset === 0 ? "This year" : fmt(timeZone, { year: "numeric" }, start);
}

const COMPARE: Record<Period, [string, string]> = {
  day: ["the same time yesterday", "the day before"],
  week: ["the same point last week", "the week before"],
  month: ["the same point last month", "the month before"],
  year: ["the same point last year", "the year before"],
};

function bucketsFor(period: Period, startDate: string, start: Date, end: Date, timeZone: string): Bucket[] {
  if (period === "day") {
    // Hour by hour in real time, so a 23 or 25 hour day still adds up.
    const out: Bucket[] = [];
    for (let t = start.getTime(); t < end.getTime(); t += 3_600_000) {
      const s = new Date(t);
      const time = localTime(s, timeZone);
      out.push({ start: s, end: new Date(Math.min(t + 3_600_000, end.getTime())), label: time.slice(0, 2), fullLabel: time });
    }
    return out;
  }

  const out: Bucket[] = [];
  const endDate = nextStartDate(period, startDate);
  for (let d = startDate; d < endDate; ) {
    const next = period === "year" ? nextStartDate("month", d) : addDays(d, 1);
    const s = atMidnight(d, timeZone);
    const e = atMidnight(next, timeZone);
    out.push({
      start: s,
      end: e,
      label:
        period === "week"
          ? fmt(timeZone, { weekday: "short" }, s)
          : period === "month"
            ? String(parts(d).d)
            : MONTHS[parts(d).m - 1],
      fullLabel:
        period === "year"
          ? fmt(timeZone, { month: "long", year: "numeric" }, s)
          : fmt(timeZone, { weekday: "short", day: "numeric", month: "short" }, s),
    });
    d = next;
  }
  return out;
}

export function periodRange(period: Period, offset: number, now: Date, timeZone: string): PeriodRange {
  const today = localDate(now, timeZone);
  const startDate = startDateOf(period, today, offset);
  const start = atMidnight(startDate, timeZone);
  const end = atMidnight(nextStartDate(period, startDate), timeZone);

  const previousStartDate = startDateOf(period, today, offset + 1);
  const compareStart = atMidnight(previousStartDate, timeZone);
  const previousEnd = atMidnight(nextStartDate(period, previousStartDate), timeZone);

  const inProgress = now.getTime() < end.getTime() && now.getTime() >= start.getTime();
  const elapsed = inProgress ? now.getTime() - start.getTime() : Infinity;
  const compareEnd = new Date(Math.min(previousEnd.getTime(), compareStart.getTime() + elapsed));

  return {
    period,
    offset,
    start,
    end,
    label: labelFor(period, offset, start, end, timeZone),
    buckets: bucketsFor(period, startDate, start, end, timeZone),
    compareStart,
    compareEnd,
    compareLabel: COMPARE[period][inProgress ? 0 : 1],
    previousEnd,
    previousLabel: COMPARE[period][1],
    inProgress,
  };
}

// Which bucket an instant falls in, or -1 if it's outside the period.
export function bucketIndex(buckets: Bucket[], instant: Date) {
  const t = instant.getTime();
  return buckets.findIndex((b) => t >= b.start.getTime() && t < b.end.getTime());
}

export function parsePeriod(value: unknown): Period {
  return (PERIODS as readonly unknown[]).includes(value) ? (value as Period) : "week";
}

// How many periods back; bounded so a pasted URL can't ask for the year 1900.
export function parseOffset(value: unknown) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 120 ? n : 0;
}

// Percentage change, or null when there's nothing to compare against.
export function percentChange(current: number, previous: number) {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}
