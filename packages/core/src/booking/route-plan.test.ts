import { describe, expect, it } from "vitest";
import { googleMapsDayUrl, planRoute, wazeUrl, type DriveTime, type RouteStop } from "./route-plan";

const at = (hhmm: string) => new Date(`2026-10-28T${hhmm}:00Z`);
const stop = (id: string, postcode: string, start: string, end: string): RouteStop => ({
  id,
  address: `1 Road, ${postcode}`,
  postcode,
  start: at(start),
  end: at(end),
  customer: id.toUpperCase(),
  service: "Valet",
});

// 20 minutes anywhere, 40 if you leave in the 10:00 rush.
const drive: DriveTime = async (_from, _to, departAt) => (departAt.getUTCHours() === 10 ? 40 : 20);

describe("planRoute", () => {
  it("works back from each job to when to leave, with the spare time", async () => {
    const plan = await planRoute({
      home: "BS1 4DJ",
      stops: [stop("b", "BS2 0AA", "11:30", "13:00"), stop("a", "BS3 1AA", "08:30", "10:30")],
      marginMins: 10,
      driveMins: drive,
    });
    expect(plan.stops.map((s) => s.id)).toEqual(["a", "b"]);
    const [first, second, home] = plan.legs;
    // Home → A: arrive 8:20, 20 min drive, leave 8:00.
    expect(first).toMatchObject({ fromId: null, toId: "a", driveMins: 20, leaveBy: at("08:00"), spareMins: null });
    // A → B: arrive 11:20; leaving around 10:40 is the rush (40 min), so leave 10:40, 10 min after A ends.
    expect(second).toMatchObject({ fromId: "a", toId: "b", driveMins: 40, leaveBy: at("10:40"), spareMins: 10 });
    expect(home).toMatchObject({ fromId: "b", toId: null, leaveBy: at("13:00"), arriveBy: at("13:20") });
    expect(plan.late).toBe(false);
  });

  it("flags a job that can't be reached on time", async () => {
    const plan = await planRoute({
      home: null,
      stops: [stop("a", "BS3 1AA", "09:00", "10:50"), stop("b", "BS2 0AA", "11:00", "12:00")],
      marginMins: 10,
      driveMins: async () => 20,
    });
    // No start point: no first or last leg.
    expect(plan.legs).toHaveLength(1);
    expect(plan.legs[0]).toMatchObject({ leaveBy: at("10:30"), spareMins: -20 });
    expect(plan.late).toBe(true);
  });

  it("needs no drive between jobs at the same postcode, and copes with an unknown drive", async () => {
    const plan = await planRoute({
      home: "BS1 4DJ",
      stops: [stop("a", "BS3 1AA", "09:00", "10:00"), stop("b", "bs31aa", "10:15", "11:00")],
      marginMins: 10,
      driveMins: async () => null,
    });
    expect(plan.legs[0]).toMatchObject({ driveMins: null, leaveBy: at("08:50") });
    expect(plan.legs[1]).toMatchObject({ driveMins: 0, spareMins: 15 });
  });
});

describe("map links", () => {
  it("opens Waze on an address", () => {
    expect(wazeUrl("1 Road, BS1 4DJ")).toBe("https://waze.com/ul?q=1%20Road%2C%20BS1%204DJ&navigate=yes");
  });

  it("puts the whole day in one Google Maps route, up to Google's 9 stops", () => {
    const url = new URL(googleMapsDayUrl("BS1 4DJ", ["A", "B"])!);
    expect(url.searchParams.get("origin")).toBe("BS1 4DJ");
    expect(url.searchParams.get("destination")).toBe("BS1 4DJ");
    expect(url.searchParams.get("waypoints")).toBe("A|B");
    expect(googleMapsDayUrl(null, ["A", "B"])).toContain("destination=B");
    expect(googleMapsDayUrl("H", Array.from({ length: 10 }, (_, i) => `S${i}`))).toBeNull();
  });
});
