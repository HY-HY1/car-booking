import { describe, expect, it } from "vitest";
import { addDays, isIsoDate, localDate, localTime, weekday, zonedTimeToUtc } from "./time";

const LONDON = "Europe/London";

describe("zonedTimeToUtc", () => {
  it("converts BST and GMT wall times", () => {
    expect(zonedTimeToUtc("2026-07-01", "09:00", LONDON).toISOString()).toBe("2026-07-01T08:00:00.000Z");
    expect(zonedTimeToUtc("2026-12-01", "09:00", LONDON).toISOString()).toBe("2026-12-01T09:00:00.000Z");
  });

  it("handles the days the clocks change", () => {
    // Clocks go back at 02:00 BST on 25 Oct 2026; forward at 01:00 GMT on 29 Mar 2026.
    expect(zonedTimeToUtc("2026-10-25", "09:00", LONDON).toISOString()).toBe("2026-10-25T09:00:00.000Z");
    expect(zonedTimeToUtc("2026-03-29", "09:00", LONDON).toISOString()).toBe("2026-03-29T08:00:00.000Z");
  });

  it("round-trips through localDate and localTime", () => {
    const instant = zonedTimeToUtc("2026-10-12", "23:30", LONDON);
    expect(localDate(instant, LONDON)).toBe("2026-10-12");
    expect(localTime(instant, LONDON)).toBe("23:30");
  });
});

describe("date helpers", () => {
  it("works out weekdays and adds days across months", () => {
    expect(weekday("2026-10-12")).toBe("mon");
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
  });

  it("validates ISO dates", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("12/10/2026")).toBe(false);
  });
});
