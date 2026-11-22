import { describe, expect, it } from "vitest";
import { parsePlaces } from "../branding/home";
import { availabilityStrip, dayLabel, stripDay } from "./next-available";

describe("availabilityStrip", () => {
  const today = "2026-11-23"; // a Monday

  it("marks each day open, full or closed", () => {
    const strip = availabilityStrip({
      today,
      workingDays: ["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27"],
      openDays: ["2026-11-25", "2026-11-27"],
    });
    expect(strip.days.map((d) => d.status)).toEqual(["full", "full", "open", "full", "open", "closed", "closed"]);
    expect(strip.next).toBe("2026-11-25");
  });

  it("finds the next free day beyond the week", () => {
    const strip = availabilityStrip({ today, workingDays: ["2026-11-24", "2026-12-08"], openDays: ["2026-12-08"] });
    expect(strip.next).toBe("2026-12-08");
    expect(strip.days.every((d) => d.status !== "open")).toBe(true);
  });

  it("says when there's nothing free", () => {
    expect(availabilityStrip({ today, workingDays: ["2026-11-24"], openDays: [] }).next).toBeNull();
  });
});

describe("dayLabel", () => {
  const today = "2026-11-23";
  it("words nearby days as people say them", () => {
    expect(dayLabel("2026-11-23", today)).toBe("Today");
    expect(dayLabel("2026-11-24", today)).toBe("Tomorrow");
    expect(dayLabel("2026-11-26", today)).toBe("Thursday");
    expect(dayLabel("2026-12-02", today)).toBe("Wednesday 2 December");
  });

  it("splits a day for the strip", () => {
    expect(stripDay("2026-11-26")).toMatchObject({ weekday: "Thu", day: "26" });
  });
});

describe("parsePlaces", () => {
  it("splits on commas and lines, dropping blanks and repeats", () => {
    expect(parsePlaces("Cheltenham, Charlton  Kings\nPrestbury,, cheltenham ;Leckhampton")).toEqual([
      "Cheltenham",
      "Charlton Kings",
      "Prestbury",
      "Leckhampton",
    ]);
  });

  it("keeps at most 40", () => {
    expect(parsePlaces(Array.from({ length: 50 }, (_, i) => `Place ${i}`).join(","))).toHaveLength(40);
  });
});
