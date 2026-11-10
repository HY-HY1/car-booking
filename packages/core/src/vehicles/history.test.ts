import { describe, expect, it } from "vitest";
import { vehicleHistory, type HistoryJob } from "./history";

const focus = { make: "Ford", model: "Focus", registration: "AB12 CDE" };
const job = (id: string, starts_at: string, over: Partial<HistoryJob> = {}): HistoryJob => ({
  id,
  starts_at,
  status: "completed",
  price_pence: 5000,
  serviceName: "Full valet",
  vehicle: focus,
  extras: [],
  ...over,
});

describe("vehicleHistory", () => {
  it("brings one car's copies back together by registration", () => {
    const cars = vehicleHistory([job("a", "2026-01-01"), job("b", "2026-03-01", { vehicle: { ...focus, registration: "ab12cde" } })]);
    expect(cars).toHaveLength(1);
    expect(cars[0].jobs.map((j) => j.id)).toEqual(["b", "a"]);
  });

  it("matches by make and model when there's no registration", () => {
    const noReg = { make: "Ford", model: "Focus", registration: null };
    expect(vehicleHistory([job("a", "2026-01-01", { vehicle: noReg }), job("b", "2026-02-01", { vehicle: noReg })])).toHaveLength(1);
  });

  it("keeps different cars apart, the most recently seen first", () => {
    const golf = { make: "VW", model: "Golf", registration: "XY34 ZZZ" };
    const cars = vehicleHistory([job("a", "2026-01-01"), job("b", "2026-05-01", { vehicle: golf })]);
    expect(cars.map((c) => c.label)).toEqual(["VW Golf", "Ford Focus"]);
  });

  it("lists a job under each car on it", () => {
    const golf = { make: "VW", model: "Golf", registration: "XY34 ZZZ" };
    const cars = vehicleHistory([job("a", "2026-01-01", { extras: [golf] })]);
    expect(cars).toHaveLength(2);
    expect(cars.every((c) => c.jobs[0].id === "a")).toBe(true);
  });

  it("skips a job with no car details", () => {
    expect(vehicleHistory([job("a", "2026-01-01", { vehicle: null })])).toEqual([]);
  });
});
