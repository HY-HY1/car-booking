import { describe, expect, it } from "vitest";
import { clockText, openingHoursLines, sameHours } from "./hours-text";

describe("clockText", () => {
  it("reads like a person writes it", () => {
    expect(clockText("09:00")).toBe("9am");
    expect(clockText("17:30")).toBe("5:30pm");
    expect(clockText("12:00")).toBe("12pm");
    expect(clockText("00:15")).toBe("12:15am");
  });
});

describe("openingHoursLines", () => {
  it("runs days with the same hours together, Monday first", () => {
    const week = { mon: [["09:00", "17:00"]], tue: [["09:00", "17:00"]], wed: [["09:00", "17:00"]], thu: [["09:00", "17:00"]], fri: [["09:00", "17:00"]], sat: [["09:00", "13:00"]] } as const;
    expect(openingHoursLines(week as never)).toEqual([
      { days: "Mon – Fri", hours: "9am – 5pm" },
      { days: "Sat", hours: "9am – 1pm" },
      { days: "Sun", hours: "Closed" },
    ]);
  });

  it("lists split days and treats empty days as closed", () => {
    expect(openingHoursLines({ mon: [["08:00", "12:00"], ["13:00", "18:00"]], tue: [] })).toEqual([
      { days: "Mon", hours: "8am – 12pm, 1pm – 6pm" },
      { days: "Tue – Sun", hours: "Closed" },
    ]);
  });
});

describe("sameHours", () => {
  it("compares what each day reads", () => {
    expect(sameHours({ mon: [["09:00", "17:00"]] }, { mon: [["09:00", "17:00"]], sun: [] })).toBe(true);
    expect(sameHours({ mon: [["09:00", "17:00"]] }, { tue: [["09:00", "17:00"]] })).toBe(false);
  });
});
