import { describe, expect, it } from "vitest";
import { availableSlots, bookableDates, type AvailabilitySettings } from "./availability";
import { localTime } from "./time";

const settings: AvailabilitySettings = {
  timezone: "Europe/London",
  weekly_hours: { mon: [["08:00", "17:00"]], wed: [["09:00", "12:00"], ["13:00", "17:00"]] },
  slot_interval_mins: 60,
  min_notice_hours: 0,
  max_days_ahead: 30,
  travel_buffer_mins: 30,
};

// Monday 12 Oct 2026 is in BST (UTC+1).
const MONDAY = "2026-10-12";
const now = new Date("2026-10-11T12:00:00Z");
const times = (slots: Date[]) => slots.map((s) => localTime(s, settings.timezone));
const at = (iso: string) => new Date(iso);

describe("availableSlots", () => {
  it("offers every start that fits in opening hours, in local time", () => {
    const slots = availableSlots({ date: MONDAY, durationMins: 240, settings, busy: [], now });
    expect(times(slots)).toEqual(["08:00", "09:00", "10:00", "11:00", "12:00", "13:00"]);
    expect(slots[0].toISOString()).toBe("2026-10-12T07:00:00.000Z");
  });

  it("is empty on closed days and outside the booking window", () => {
    expect(availableSlots({ date: "2026-10-13", durationMins: 60, settings, busy: [], now })).toEqual([]);
    expect(availableSlots({ date: "2026-10-05", durationMins: 60, settings, busy: [], now })).toEqual([]);
    expect(availableSlots({ date: "2026-12-07", durationMins: 60, settings, busy: [], now })).toEqual([]);
  });

  it("uses each opening window separately", () => {
    const slots = availableSlots({ date: "2026-10-14", durationMins: 180, settings, busy: [], now });
    expect(times(slots)).toEqual(["09:00", "13:00", "14:00"]);
  });

  it("keeps the travel buffer around existing jobs", () => {
    // Job 11:00–13:00 local. A 1-hour job needs 30 min clear either side.
    const busy = [{ kind: "job" as const, start: at("2026-10-12T10:00:00Z"), end: at("2026-10-12T12:00:00Z") }];
    const slots = availableSlots({ date: MONDAY, durationMins: 60, settings, busy, now });
    expect(times(slots)).toEqual(["08:00", "09:00", "14:00", "15:00", "16:00"]);
  });

  it("uses the drive time when it's longer than the buffer", () => {
    const busy = [
      { kind: "job" as const, start: at("2026-10-12T10:00:00Z"), end: at("2026-10-12T12:00:00Z"), travelMins: 75 },
    ];
    const slots = availableSlots({ date: MONDAY, durationMins: 60, settings, busy, now });
    expect(times(slots)).toEqual(["08:00", "15:00", "16:00"]);
  });

  it("needs no gap around blocked time", () => {
    const busy = [{ kind: "blocked" as const, start: at("2026-10-12T07:00:00Z"), end: at("2026-10-12T12:00:00Z") }];
    const slots = availableSlots({ date: MONDAY, durationMins: 60, settings, busy, now });
    expect(times(slots)).toEqual(["13:00", "14:00", "15:00", "16:00"]);
  });

  it("respects minimum notice", () => {
    const slots = availableSlots({
      date: MONDAY,
      durationMins: 60,
      settings: { ...settings, min_notice_hours: 24 },
      busy: [],
      now: new Date("2026-10-11T09:30:00Z"), // 10:30 BST Sunday
    });
    expect(times(slots)).toEqual(["11:00", "12:00", "13:00", "14:00", "15:00", "16:00"]);
  });

  it("follows the clock change at the end of October", () => {
    // Monday 26 Oct 2026 is in GMT, so 08:00 local is 08:00 UTC.
    const slots = availableSlots({ date: "2026-10-26", durationMins: 60, settings, busy: [], now });
    expect(slots[0].toISOString()).toBe("2026-10-26T08:00:00.000Z");
  });
});

describe("bookableDates", () => {
  it("lists open days within the window", () => {
    const dates = bookableDates({ ...settings, max_days_ahead: 9 }, now);
    expect(dates).toEqual(["2026-10-12", "2026-10-14", "2026-10-19"]);
  });
});
