import { describe, expect, it } from "vitest";
import {
  allowedStatusChanges,
  assignLanes,
  diaryDays,
  diaryRange,
  minuteOfDay,
  parseDiaryDate,
  parseView,
  placeOnDay,
  resourceHours,
  stepDate,
  travelLegs,
  unionHours,
  visibleHours,
} from "./diary";

const LONDON = "Europe/London";
const at = (iso: string) => new Date(iso);

describe("view and date from the address", () => {
  it("falls back to the week view and today", () => {
    expect(parseView("day")).toBe("day");
    expect(parseView("month")).toBe("week");
    expect(parseView(undefined)).toBe("week");
    expect(parseDiaryDate("2026-10-20", "2026-10-13")).toBe("2026-10-20");
    expect(parseDiaryDate("2026-02-30", "2026-10-13")).toBe("2026-10-13");
    expect(parseDiaryDate("1900-01-01", "2026-10-13")).toBe("2026-10-13");
    expect(parseDiaryDate(["2026-10-20"], "2026-10-13")).toBe("2026-10-13");
  });
});

describe("diaryDays", () => {
  it("runs a week Monday to Sunday whichever day is picked", () => {
    // 13 Oct 2026 is a Tuesday.
    expect(diaryDays("week", "2026-10-13")).toEqual([
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
    ]);
    expect(diaryDays("week", "2026-10-18")[0]).toBe("2026-10-12"); // Sunday
    expect(diaryDays("week", "2026-10-12")[0]).toBe("2026-10-12"); // Monday
    expect(diaryDays("day", "2026-10-13")).toEqual(["2026-10-13"]);
  });

  it("steps by a week or a day, across month ends", () => {
    expect(stepDate("week", "2026-10-28", 1)).toBe("2026-11-04");
    expect(stepDate("day", "2026-11-01", -1)).toBe("2026-10-31");
  });

  it("covers the clocks going back as a 25 hour day", () => {
    // Clocks go back on Sunday 25 Oct 2026.
    const { start, end } = diaryRange(["2026-10-25"], LONDON);
    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(25);
  });
});

describe("placeOnDay", () => {
  it("reads the wall clock in the business's zone", () => {
    // 13:30 UTC in October is 14:30 BST.
    expect(minuteOfDay(at("2026-10-13T13:30:00Z"), "2026-10-13", LONDON)).toBe(14 * 60 + 30);
    expect(placeOnDay(at("2026-10-13T13:30:00Z"), at("2026-10-13T15:00:00Z"), "2026-10-13", LONDON)).toEqual({
      start: 14 * 60 + 30,
      end: 16 * 60,
    });
  });

  it("clips something that runs past midnight to each day", () => {
    const start = at("2026-10-13T20:00:00Z"); // 21:00 BST
    const end = at("2026-10-14T07:00:00Z"); // 08:00 BST next day
    expect(placeOnDay(start, end, "2026-10-13", LONDON)).toEqual({ start: 21 * 60, end: 24 * 60 });
    expect(placeOnDay(start, end, "2026-10-14", LONDON)).toEqual({ start: 0, end: 8 * 60 });
    expect(placeOnDay(start, end, "2026-10-15", LONDON)).toBeNull();
    expect(placeOnDay(start, end, "2026-10-12", LONDON)).toBeNull();
  });

  it("puts a 9am job at 9am on both sides of a clock change", () => {
    expect(minuteOfDay(at("2026-10-24T08:00:00Z"), "2026-10-24", LONDON)).toBe(9 * 60); // BST
    expect(minuteOfDay(at("2026-10-26T09:00:00Z"), "2026-10-26", LONDON)).toBe(9 * 60); // GMT
  });
});

describe("assignLanes", () => {
  it("gives separate jobs the full width", () => {
    const out = assignLanes([
      { start: 540, end: 600 },
      { start: 600, end: 660 },
    ]);
    expect(out.map((o) => [o.lane, o.lanes])).toEqual([
      [0, 1],
      [0, 1],
    ]);
  });

  it("puts overlapping items side by side and shares the count in the cluster", () => {
    const out = assignLanes([
      { start: 540, end: 720, id: "a" },
      { start: 600, end: 660, id: "b" },
      { start: 700, end: 760, id: "c" },
      { start: 900, end: 960, id: "d" },
    ]);
    const byId = Object.fromEntries(out.map((o) => [o.id, [o.lane, o.lanes]]));
    expect(byId.a).toEqual([0, 2]);
    expect(byId.b).toEqual([1, 2]);
    // c starts after b ends, so it reuses b's lane; d is on its own.
    expect(byId.c).toEqual([1, 2]);
    expect(byId.d).toEqual([0, 1]);
  });

  it("copes with nothing", () => {
    expect(assignLanes([])).toEqual([]);
  });
});

describe("visibleHours", () => {
  const hours = { mon: [["08:30", "17:00"]], tue: [["09:00", "13:00"], ["14:00", "18:00"]] } as never;

  it("covers the working day with an hour either side", () => {
    expect(visibleHours(["2026-10-12"], hours, [])).toEqual({ from: 7 * 60, to: 18 * 60 });
    expect(visibleHours(["2026-10-12", "2026-10-13"], hours, [])).toEqual({ from: 7 * 60, to: 19 * 60 });
  });

  it("stretches to include a job outside working hours", () => {
    expect(visibleHours(["2026-10-12"], hours, [{ start: 5 * 60 + 30, end: 6 * 60 }])).toEqual({
      from: 4 * 60,
      to: 18 * 60,
    });
    expect(visibleHours(["2026-10-12"], hours, [{ start: 20 * 60, end: 23 * 60 + 30 }]).to).toBe(24 * 60);
  });

  it("has a sensible default when the business is closed and the day is empty", () => {
    expect(visibleHours(["2026-10-18"], hours, [])).toEqual({ from: 8 * 60, to: 18 * 60 });
  });
});

describe("travelLegs", () => {
  const bristol = { lat: 51.4545, lng: -2.5879 };
  const bath = { lat: 51.3811, lng: -2.359 };
  const coords = (pc: string) => ({ BS11AA: bristol, BA11AA: bath })[pc.replace(/\s/g, "")];
  const job = (id: string, start: string, end: string, postcode: string) => ({
    id,
    start: at(start),
    end: at(end),
    postcode,
  });

  it("estimates the drive and compares it with the gap", () => {
    const [leg] = travelLegs(
      [
        job("a", "2026-10-13T08:00:00Z", "2026-10-13T10:00:00Z", "BS1 1AA"),
        job("b", "2026-10-13T11:30:00Z", "2026-10-13T13:00:00Z", "BA1 1AA"),
      ],
      coords,
      30,
    );
    expect(leg.fromId).toBe("a");
    expect(leg.toId).toBe("b");
    expect(leg.gapMins).toBe(90);
    // About 11 miles as the crow flies, so 25-35 minutes by the engine's rule.
    expect(leg.driveMins).toBeGreaterThanOrEqual(25);
    expect(leg.driveMins).toBeLessThanOrEqual(40);
    expect(leg.requiredMins).toBe(Math.max(30, leg.driveMins!));
    expect(leg.tight).toBe(false);
  });

  it("flags a gap shorter than the drive", () => {
    const [leg] = travelLegs(
      [
        job("a", "2026-10-13T08:00:00Z", "2026-10-13T10:00:00Z", "BS1 1AA"),
        job("b", "2026-10-13T10:10:00Z", "2026-10-13T12:00:00Z", "BA1 1AA"),
      ],
      coords,
      0,
    );
    expect(leg.tight).toBe(true);
  });

  it("uses the buffer when the postcodes are the same or unknown", () => {
    const legs = travelLegs(
      [
        job("a", "2026-10-13T08:00:00Z", "2026-10-13T10:00:00Z", "BS1 1AA"),
        job("b", "2026-10-13T10:45:00Z", "2026-10-13T12:00:00Z", "BS11AA"),
        job("c", "2026-10-13T12:10:00Z", "2026-10-13T13:00:00Z", "ZZ9 9ZZ"),
      ],
      coords,
      30,
    );
    expect(legs[0].driveMins).toBe(0);
    expect(legs[0].tight).toBe(false);
    expect(legs[1].driveMins).toBeNull();
    expect(legs[1].requiredMins).toBe(30);
    expect(legs[1].tight).toBe(true); // 10 minutes against a 30 minute buffer
  });

  it("sorts the jobs itself and leaves out long breaks and overlaps", () => {
    const legs = travelLegs(
      [
        job("late", "2026-10-13T16:00:00Z", "2026-10-13T17:00:00Z", "BS1 1AA"),
        job("early", "2026-10-13T08:00:00Z", "2026-10-13T09:00:00Z", "BS1 1AA"),
        job("clash", "2026-10-13T08:30:00Z", "2026-10-13T09:30:00Z", "BS1 1AA"),
      ],
      coords,
      30,
    );
    // early→clash overlaps; clash→late is a 6.5 hour break.
    expect(legs).toEqual([]);
  });
});

describe("allowedStatusChanges", () => {
  it("lets a confirmed job be completed, missed or cancelled", () => {
    expect(allowedStatusChanges("confirmed")).toEqual(["completed", "no_show", "cancelled"]);
  });
  it("lets finished and cancelled jobs be put back", () => {
    for (const s of ["completed", "no_show", "cancelled"]) expect(allowedStatusChanges(s)).toEqual(["confirmed"]);
  });
  it("only lets a hold be dropped, and leaves expired holds alone", () => {
    expect(allowedStatusChanges("held")).toEqual(["cancelled"]);
    expect(allowedStatusChanges("expired")).toEqual([]);
    expect(allowedStatusChanges("nonsense")).toEqual([]);
  });
});

describe("resource hours", () => {
  const settings = {
    weekly_hours: { mon: [["08:00", "17:00"]] as [string, string][] },
    unit_weekly_hours: { sat: [["09:00", "13:00"]] as [string, string][] },
  };

  it("joins windows day by day", () => {
    expect(
      unionHours([{ mon: [["08:00", "12:00"]] }, { mon: [["13:00", "17:00"]], tue: [["09:00", "10:00"]] }, {}]),
    ).toEqual({ mon: [["08:00", "12:00"], ["13:00", "17:00"]], tue: [["09:00", "10:00"]] });
  });

  it("shows a van on the business's mobile hours, a bay on the shop's, and someone doing both on both", () => {
    expect(resourceHours(settings, { weekly_hours: null, location_types: ["mobile"] })).toEqual(settings.weekly_hours);
    expect(resourceHours(settings, { weekly_hours: null, location_types: ["unit"] })).toEqual(settings.unit_weekly_hours);
    expect(resourceHours(settings, { weekly_hours: null, location_types: ["mobile", "unit"] })).toEqual({
      mon: [["08:00", "17:00"]],
      sat: [["09:00", "13:00"]],
    });
  });

  it("uses its own hours when it has them", () => {
    const own = { fri: [["10:00", "14:00"]] as [string, string][] };
    expect(resourceHours(settings, { weekly_hours: own, location_types: ["mobile", "unit"] })).toEqual(own);
  });

  it("spaces jobs by a rule for each pair", () => {
    const at = (iso: string) => new Date(iso);
    const jobs = [
      { id: "a", start: at("2026-10-13T08:00:00Z"), end: at("2026-10-13T09:00:00Z"), postcode: "BS1 1AA", locationType: "unit" as const },
      { id: "b", start: at("2026-10-13T09:10:00Z"), end: at("2026-10-13T10:00:00Z"), postcode: "BS1 1AA", locationType: "unit" as const },
    ];
    const rule = (a: { locationType?: string }, b: { locationType?: string }) => (a.locationType === "unit" && b.locationType === "unit" ? 5 : 30);
    expect(travelLegs(jobs, () => undefined, rule)[0]).toMatchObject({ requiredMins: 5, tight: false });
    expect(travelLegs(jobs, () => undefined, 30)[0]).toMatchObject({ requiredMins: 30, tight: true });
  });
});
