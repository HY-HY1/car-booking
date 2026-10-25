import { describe, expect, it } from "vitest";
import { addMonths, groupByTimeOfDay, longDate, monthGrid, monthsBetween, monthTitle } from "./calendar";

describe("monthGrid", () => {
  it("starts weeks on Monday and pads the ends", () => {
    // October 2026 starts on a Thursday.
    const weeks = monthGrid("2026-10");
    expect(weeks[0]).toEqual([null, null, null, "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
    expect(weeks.at(-1)!.at(-1)).toBeNull();
  });

  it("handles a month that starts on Monday and one that starts on Sunday", () => {
    expect(monthGrid("2026-06")[0][0]).toBe("2026-06-01"); // Mon 1 June 2026
    expect(monthGrid("2026-02")[0].indexOf("2026-02-01")).toBe(6); // Sun 1 Feb 2026
    expect(monthGrid("2026-02").flat().filter(Boolean)).toHaveLength(28);
  });

  it("knows leap years", () => {
    expect(monthGrid("2028-02").flat().filter(Boolean)).toHaveLength(29);
  });
});

describe("months", () => {
  it("steps across year ends in both directions", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-10", 0)).toBe("2026-10");
  });

  it("lists the months a booking window touches", () => {
    expect(monthsBetween("2026-10-14", "2026-12-12")).toEqual(["2026-10", "2026-11", "2026-12"]);
    expect(monthsBetween("2026-12-20", "2027-01-05")).toEqual(["2026-12", "2027-01"]);
    expect(monthsBetween("2026-10-14", "2026-10-30")).toEqual(["2026-10"]);
  });
});

describe("labels", () => {
  it("name months and days without drifting a day", () => {
    expect(monthTitle("2026-10")).toBe("October 2026");
    expect(longDate("2026-10-16")).toBe("Friday 16 October");
    expect(longDate("2026-03-29")).toBe("Sunday 29 March"); // clocks change that day
  });
});

describe("groupByTimeOfDay", () => {
  const slot = (time: string) => ({ time });

  it("splits at midday and five o'clock, keeping order", () => {
    const groups = groupByTimeOfDay(["08:00", "11:30", "12:00", "16:30", "17:00", "19:00"].map(slot));
    expect(groups.map(([name, list]) => [name, list.map((s) => s.time)])).toEqual([
      ["Morning", ["08:00", "11:30"]],
      ["Afternoon", ["12:00", "16:30"]],
      ["Evening", ["17:00", "19:00"]],
    ]);
  });

  it("leaves out parts of the day with nothing free", () => {
    expect(groupByTimeOfDay(["09:00", "10:00"].map(slot)).map(([name]) => name)).toEqual(["Morning"]);
    expect(groupByTimeOfDay([])).toEqual([]);
  });
});
