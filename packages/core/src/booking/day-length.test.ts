import { describe, expect, it } from "vitest";
import { longestJobMins, longestWindow } from "./day-length";

const settings = {
  weekly_hours: { mon: [["09:00", "17:00"]], sat: [["08:00", "12:00"], ["13:00", "16:00"]] },
  unit_weekly_hours: { tue: [["07:30", "18:00"]] },
} as const;
const resource = (location_types: ("mobile" | "unit")[], weekly_hours: Record<string, [string, string][]> | null = null, sort_order = 0) => ({
  location_types,
  weekly_hours,
  sort_order,
});

describe("longest job in one go", () => {
  it("is the longest single window: a break splits a day", () => {
    expect(longestWindow(settings.weekly_hours as never)).toBe(480);
    expect(longestWindow({ sat: [["08:00", "12:00"], ["13:00", "16:00"]] })).toBe(240);
    expect(longestWindow({})).toBe(0);
  });

  it("uses the hours for that kind of job, or a resource's own hours", () => {
    expect(longestJobMins(settings as never, [resource(["mobile", "unit"])], "mobile")).toBe(480);
    expect(longestJobMins(settings as never, [resource(["mobile", "unit"])], "unit")).toBe(630);
    // A second van with a longer day can take the longer job.
    expect(longestJobMins(settings as never, [resource(["mobile"]), resource(["mobile"], { fri: [["06:00", "20:00"]] }, 1)], "mobile")).toBe(840);
  });

  it("knows nothing when nothing does that kind of job", () => {
    expect(longestJobMins(settings as never, [resource(["unit"])], "mobile")).toBeNull();
  });
});
