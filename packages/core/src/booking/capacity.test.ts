import { describe, expect, it } from "vitest";
import type { BusyPeriod } from "./availability";
import { bookableDatesFor, bookableDatesForAny, openSlots, summariseCapacity, type CapacityResource, type CapacitySettings } from "./capacity";
import { bufferFor, hoursFor, resourcesFor } from "./config";
import { localTime } from "./time";

const settings: CapacitySettings = {
  timezone: "Europe/London",
  weekly_hours: { mon: [["08:00", "12:00"]], tue: [["08:00", "12:00"]] },
  unit_weekly_hours: null,
  slot_interval_mins: 60,
  min_notice_hours: 0,
  max_days_ahead: 30,
  travel_buffer_mins: 30,
};

const van = (id: string, sort_order = 0, extra: Partial<CapacityResource> = {}): CapacityResource => ({
  id,
  location_types: ["mobile"],
  weekly_hours: null,
  sort_order,
  ...extra,
});

// Monday 12 Oct 2026, BST.
const MONDAY = "2026-10-12";
const now = new Date("2026-10-11T12:00:00Z");
const at = (iso: string) => new Date(iso);
const job = (start: string, end: string, extra: Partial<BusyPeriod> = {}) =>
  ({ kind: "job" as const, start: at(start), end: at(end), ...extra }) as BusyPeriod;
const query = (over: Partial<Parameters<typeof openSlots>[0]> = {}) => ({
  date: MONDAY,
  durationMins: 120,
  locationType: "mobile" as const,
  settings,
  resources: [van("a")],
  busyByResource: new Map<string, BusyPeriod[]>(),
  now,
  ...over,
});
const times = (offers: ReturnType<typeof openSlots>) => offers.map((o) => localTime(o.start, "Europe/London"));

describe("openSlots", () => {
  it("is one van's availability with a single van", () => {
    expect(times(openSlots(query()))).toEqual(["08:00", "09:00", "10:00"]);
  });

  it("offers a time while any van is free and says which", () => {
    // Van A has a job 08:00-10:00 (BST: 07:00Z-09:00Z); van B is empty.
    const offers = openSlots(
      query({
        resources: [van("a", 0), van("b", 1)],
        busyByResource: new Map([["a", [job("2026-10-12T07:00:00Z", "2026-10-12T09:00:00Z")]]]),
      }),
    );
    // 08:00 only van B; later starts can't fit around A's job + buffer on A but B is free all morning.
    expect(times(offers)).toEqual(["08:00", "09:00", "10:00"]);
    expect(offers[0].resourceIds).toEqual(["b"]);
    expect(offers[2].resourceIds).toEqual(["b"]);
  });

  it("fills vans in order: the first free van comes first", () => {
    const offers = openSlots(query({ resources: [van("b", 1), van("a", 0)] }));
    expect(offers[0].resourceIds).toEqual(["a", "b"]);
  });

  it("is full only when every van is busy", () => {
    const busy = [job("2026-10-12T07:00:00Z", "2026-10-12T11:00:00Z")];
    const full = openSlots(
      query({
        resources: [van("a"), van("b")],
        busyByResource: new Map([
          ["a", busy],
          ["b", busy],
        ]),
      }),
    );
    expect(full).toEqual([]);
    const oneFree = openSlots(
      query({ resources: [van("a"), van("b")], busyByResource: new Map([["a", busy]]) }),
    );
    expect(times(oneFree)).toEqual(["08:00", "09:00", "10:00"]);
  });

  it("only uses resources that do this kind of job", () => {
    const bay: CapacityResource = { id: "bay", location_types: ["unit"], weekly_hours: null, sort_order: 0 };
    expect(openSlots(query({ resources: [bay] }))).toEqual([]);
    expect(times(openSlots(query({ resources: [bay], locationType: "unit" })))).toEqual(["08:00", "09:00", "10:00"]);
  });

  it("follows each resource's own hours", () => {
    const afternoons = van("b", 1, { weekly_hours: { mon: [["13:00", "17:00"]] } });
    const offers = openSlots(query({ resources: [afternoons], durationMins: 60 }));
    expect(times(offers)).toEqual(["13:00", "14:00", "15:00", "16:00"]);
  });

  it("uses the shop's hours for shop jobs and mobile hours for mobile", () => {
    const shopSettings: CapacitySettings = { ...settings, unit_weekly_hours: { mon: [["14:00", "17:00"]] } };
    const both: CapacityResource = { id: "x", location_types: ["mobile", "unit"], weekly_hours: null, sort_order: 0 };
    expect(times(openSlots(query({ settings: shopSettings, resources: [both], durationMins: 60 })))).toEqual([
      "08:00",
      "09:00",
      "10:00",
      "11:00",
    ]);
    expect(
      times(openSlots(query({ settings: shopSettings, resources: [both], durationMins: 60, locationType: "unit" }))),
    ).toEqual(["14:00", "15:00", "16:00"]);
  });

  it("a block on one van leaves the other bookable", () => {
    const blocked: BusyPeriod[] = [
      { kind: "blocked", start: at("2026-10-12T07:00:00Z"), end: at("2026-10-12T11:00:00Z") },
    ];
    const offers = openSlots(
      query({ resources: [van("a"), van("b")], busyByResource: new Map([["a", blocked]]) }),
    );
    expect(offers.every((o) => o.resourceIds.join() === "b")).toBe(true);
    expect(offers.length).toBe(3);
  });

  it("uses a shop turnaround rather than the travel buffer between shop jobs", () => {
    const bay: CapacityResource = { id: "bay", location_types: ["unit"], weekly_hours: null, sort_order: 0 };
    // Job 08:00-09:00 local; with a 0 minute turnaround a 1 hour job fits at 09:00.
    const busy = new Map<string, BusyPeriod[]>([
      ["bay", [job("2026-10-12T07:00:00Z", "2026-10-12T08:00:00Z", { bufferMins: 0 })]],
    ]);
    const offers = openSlots(query({ resources: [bay], locationType: "unit", durationMins: 60, busyByResource: busy }));
    expect(times(offers)).toEqual(["09:00", "10:00", "11:00"]);
    // With the travel buffer it would have been 10:00 onwards.
    const withBuffer = new Map<string, BusyPeriod[]>([["bay", [job("2026-10-12T07:00:00Z", "2026-10-12T08:00:00Z")]]]);
    expect(
      times(openSlots(query({ resources: [bay], locationType: "unit", durationMins: 60, busyByResource: withBuffer }))),
    ).toEqual(["10:00", "11:00"]);
  });
});

describe("bookable dates", () => {
  it("counts a day if any van is open", () => {
    const wednesdays = van("b", 1, { weekly_hours: { wed: [["09:00", "12:00"]] } });
    const dates = bookableDatesFor({ ...settings, max_days_ahead: 9 }, [van("a"), wednesdays], "mobile", now);
    expect(dates).toEqual(["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-19", "2026-10-20"]);
  });

  it("is empty with no resource for that kind of job", () => {
    expect(bookableDatesFor(settings, [van("a")], "unit", now)).toEqual([]);
  });

  it("combines the kinds a business offers", () => {
    const shop: CapacityResource = { id: "s", location_types: ["unit"], weekly_hours: { fri: [["09:00", "12:00"]] }, sort_order: 1 };
    const dates = bookableDatesForAny({ ...settings, max_days_ahead: 5 }, [van("a"), shop], ["mobile", "unit"], now);
    expect(dates).toEqual(["2026-10-12", "2026-10-13", "2026-10-16"]);
  });
});

describe("config helpers", () => {
  it("picks hours: own, then shop, then business", () => {
    const s = { weekly_hours: { mon: [["08:00", "17:00"]] }, unit_weekly_hours: { tue: [["10:00", "14:00"]] } } as never;
    expect(hoursFor(s, { weekly_hours: null }, "mobile")).toEqual({ mon: [["08:00", "17:00"]] });
    expect(hoursFor(s, { weekly_hours: null }, "unit")).toEqual({ tue: [["10:00", "14:00"]] });
    expect(hoursFor(s, { weekly_hours: { wed: [["09:00", "10:00"]] } }, "unit")).toEqual({ wed: [["09:00", "10:00"]] });
    const same = { weekly_hours: { mon: [["08:00", "17:00"]] }, unit_weekly_hours: null } as never;
    expect(hoursFor(same, { weekly_hours: null }, "unit")).toEqual({ mon: [["08:00", "17:00"]] });
  });

  it("uses the turnaround only between two shop jobs", () => {
    const s = { travel_buffer_mins: 30, unit_buffer_mins: 10 };
    expect(bufferFor(s, "unit", "unit")).toBe(10);
    expect(bufferFor(s, "mobile", "unit")).toBe(30);
    expect(bufferFor(s, "mobile", "mobile")).toBe(30);
  });

  it("lists resources for a kind of job in filling order", () => {
    const list = [
      { id: "b", location_types: ["mobile"] as ("mobile" | "unit")[], sort_order: 2 },
      { id: "a", location_types: ["mobile", "unit"] as ("mobile" | "unit")[], sort_order: 1 },
      { id: "c", location_types: ["unit"] as ("mobile" | "unit")[], sort_order: 0 },
    ];
    expect(resourcesFor(list, "mobile").map((r) => r.id)).toEqual(["a", "b"]);
    expect(resourcesFor(list, "unit").map((r) => r.id)).toEqual(["c", "a"]);
  });
});

describe("summariseCapacity", () => {
  const sets = { weekly_hours: { mon: [["08:00", "17:00"]] as [string, string][] }, unit_weekly_hours: null };
  const r = (id: string, name: string, types: ("mobile" | "unit")[], active = true) => ({
    id,
    name,
    location_types: types,
    weekly_hours: null,
    sort_order: 0,
    active,
  });

  it("counts vans and bays that are switched on", () => {
    const out = summariseCapacity({ ...sets, offers_mobile: true, offers_unit: true }, [
      r("1", "Van 1", ["mobile"]),
      r("2", "Van 2", ["mobile"]),
      r("3", "Van 3", ["mobile"], false),
      r("4", "Bay", ["unit"]),
    ]);
    expect(out).toEqual({ mobile: 2, unit: 1, warnings: [] });
  });

  it("counts someone who does both in both", () => {
    const out = summariseCapacity({ ...sets, offers_mobile: true, offers_unit: true }, [r("1", "Me", ["mobile", "unit"])]);
    expect(out).toMatchObject({ mobile: 1, unit: 1 });
  });

  it("warns when a kind is on with nothing to do it", () => {
    const out = summariseCapacity({ ...sets, offers_mobile: true, offers_unit: false }, [r("1", "Van", ["mobile"], false)]);
    expect(out.mobile).toBe(0);
    expect(out.warnings[0]).toMatch(/Mobile jobs are switched on, but no van or bay/);
  });

  it("warns when vans are ignored because their kind of job is off", () => {
    const out = summariseCapacity({ ...sets, offers_mobile: true, offers_unit: false }, [
      r("1", "Van", ["mobile"]),
      r("2", "Bay", ["unit"]),
    ]);
    expect(out).toMatchObject({ mobile: 1, unit: 0 });
    expect(out.warnings).toEqual(["Shop jobs are switched off, so Bay won't be used for shop work."]);
  });

  it("warns when there are no opening hours", () => {
    const out = summariseCapacity({ weekly_hours: {}, unit_weekly_hours: null, offers_mobile: true, offers_unit: false }, [
      r("1", "Van", ["mobile"]),
    ]);
    expect(out.warnings).toEqual(["No opening hours are set for mobile jobs, so nothing can be booked."]);
  });
});
