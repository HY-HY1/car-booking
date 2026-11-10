import { describe, expect, it } from "vitest";
import { conversionBySource, isLostReason, lostReasonCounts } from "./rules";

describe("conversionBySource", () => {
  it("counts leads and bookings per source, busiest first", () => {
    const rows = conversionBySource([
      { source: "website", status: "booked" },
      { source: "instagram", status: "lost" },
      { source: "website", status: "quoted" },
      { source: "website", status: "booked" },
      { source: "website", status: "new" },
    ]);
    expect(rows).toEqual([
      { source: "website", total: 4, booked: 2, rate: 50 },
      { source: "instagram", total: 1, booked: 0, rate: 0 },
    ]);
  });
});

describe("lostReasonCounts", () => {
  it("counts only lost leads, and files those without a reason together", () => {
    expect(
      lostReasonCounts([
        { status: "lost", lost_reason: "price" },
        { status: "lost", lost_reason: "price" },
        { status: "lost", lost_reason: null },
        { status: "booked", lost_reason: "price" },
      ]),
    ).toEqual([
      { reason: "price", count: 2 },
      { reason: "unknown", count: 1 },
    ]);
  });
});

describe("isLostReason", () => {
  it("accepts only the listed reasons", () => {
    expect(isLostReason("price")).toBe(true);
    expect(isLostReason("constructor")).toBe(false);
  });
});
