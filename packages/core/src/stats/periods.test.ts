import { describe, expect, it } from "vitest";
import { bucketIndex, parseOffset, parsePeriod, percentChange, periodRange } from "./periods";

const TZ = "Europe/London";
// Wednesday 14 October 2026, 15:30 in London (BST, UTC+1).
const NOW = new Date("2026-10-14T14:30:00Z");

describe("day", () => {
  const r = periodRange("day", 0, NOW, TZ);

  it("runs midnight to midnight London time", () => {
    expect(r.start.toISOString()).toBe("2026-10-13T23:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-10-14T23:00:00.000Z");
    expect(r.label).toBe("Today");
  });

  it("has 24 hourly buckets labelled by local hour", () => {
    expect(r.buckets).toHaveLength(24);
    expect(r.buckets[0].label).toBe("00");
    expect(r.buckets[15].fullLabel).toBe("15:00");
  });

  it("compares with yesterday up to the same time", () => {
    expect(r.inProgress).toBe(true);
    expect(r.compareStart.toISOString()).toBe("2026-10-12T23:00:00.000Z");
    expect(r.compareEnd.toISOString()).toBe("2026-10-13T14:30:00.000Z");
    expect(r.compareLabel).toBe("the same time yesterday");
  });

  it("is 25 hours long when the clocks go back, and 23 when they go forward", () => {
    const back = periodRange("day", 0, new Date("2026-10-25T12:00:00Z"), TZ);
    expect(back.buckets).toHaveLength(25);
    const forward = periodRange("day", 0, new Date("2026-03-29T12:00:00Z"), TZ);
    expect(forward.buckets).toHaveLength(23);
  });
});

describe("week", () => {
  const r = periodRange("week", 0, NOW, TZ);

  it("starts on Monday", () => {
    expect(r.start.toISOString()).toBe("2026-10-11T23:00:00.000Z"); // Mon 12 Oct 00:00 BST
    expect(r.end.toISOString()).toBe("2026-10-18T23:00:00.000Z");
    expect(r.buckets.map((b) => b.label)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  });

  it("treats a Sunday as the last day of its week, not the first of the next", () => {
    const sunday = periodRange("week", 0, new Date("2026-10-18T10:00:00Z"), TZ);
    expect(sunday.start.toISOString()).toBe("2026-10-11T23:00:00.000Z");
  });

  it("names earlier weeks by their dates", () => {
    expect(periodRange("week", 1, NOW, TZ).label).toBe("Last week");
    expect(periodRange("week", 3, NOW, TZ).label).toBe("21 Sept to 27 Sept 2026");
  });
});

describe("month", () => {
  it("has a bucket per day, and stops at the month end", () => {
    const oct = periodRange("month", 0, NOW, TZ);
    expect(oct.buckets).toHaveLength(31);
    expect(oct.start.toISOString()).toBe("2026-09-30T23:00:00.000Z");
    expect(periodRange("month", 8, NOW, TZ).buckets).toHaveLength(28); // February
  });

  it("steps back across a year boundary", () => {
    const r = periodRange("month", 10, NOW, TZ);
    expect(r.label).toBe("December 2025");
    expect(r.buckets).toHaveLength(31);
  });

  it("compares a part-finished month with the same stretch of the last", () => {
    const r = periodRange("month", 0, NOW, TZ);
    expect(r.compareStart.toISOString()).toBe("2026-08-31T23:00:00.000Z"); // 1 Sep
    expect(r.compareEnd.getTime() - r.compareStart.getTime()).toBe(NOW.getTime() - r.start.getTime());
  });
});

describe("year", () => {
  it("has twelve month buckets", () => {
    const r = periodRange("year", 0, NOW, TZ);
    expect(r.buckets.map((b) => b.label)).toEqual(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]);
    expect(r.start.toISOString()).toBe("2026-01-01T00:00:00.000Z"); // GMT in January
    expect(periodRange("year", 1, NOW, TZ).label).toBe("2025");
  });
});

describe("a finished period", () => {
  it("is compared with the whole of the one before", () => {
    const last = periodRange("week", 1, NOW, TZ);
    expect(last.inProgress).toBe(false);
    expect(last.compareEnd.toISOString()).toBe(periodRange("week", 1, NOW, TZ).start.toISOString());
    expect(last.compareLabel).toBe("the week before");
  });
});

describe("buckets", () => {
  it("cover the period exactly, with no gaps or overlaps", () => {
    for (const period of ["day", "week", "month", "year"] as const) {
      const r = periodRange(period, 0, NOW, TZ);
      expect(r.buckets[0].start.getTime()).toBe(r.start.getTime());
      expect(r.buckets.at(-1)!.end.getTime()).toBe(r.end.getTime());
      r.buckets.slice(1).forEach((b, i) => expect(b.start.getTime()).toBe(r.buckets[i].end.getTime()));
    }
  });

  it("find where an instant belongs", () => {
    const r = periodRange("week", 0, NOW, TZ);
    expect(bucketIndex(r.buckets, new Date("2026-10-14T09:00:00Z"))).toBe(2); // Wednesday
    expect(bucketIndex(r.buckets, new Date("2026-10-11T22:59:59Z"))).toBe(-1); // before Monday
    expect(bucketIndex(r.buckets, r.end)).toBe(-1);
  });
});

describe("parsing", () => {
  it("falls back to safe values", () => {
    expect(parsePeriod("month")).toBe("month");
    expect(parsePeriod("decade")).toBe("week");
    expect(parsePeriod(undefined)).toBe("week");
    expect(parseOffset("3")).toBe(3);
    for (const bad of ["-1", "1.5", "abc", "9999", undefined]) expect(parseOffset(bad)).toBe(0);
  });

  it("works out percentage change, and refuses to divide by nothing", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(5, 0)).toBeNull();
    expect(percentChange(0, 0)).toBeNull();
  });
});
