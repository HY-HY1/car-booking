import { describe, expect, it } from "vitest";
import { earliest, timeToFirstEnquiry } from "./milestones";

describe("earliest", () => {
  it("picks the earlier of two times", () => {
    expect(earliest("2026-10-05T10:00:00Z", "2026-10-03T09:00:00Z")).toBe("2026-10-03T09:00:00Z");
  });

  it("ignores missing and unreadable times", () => {
    expect(earliest(null, "2026-10-05T10:00:00Z", undefined, "nonsense")).toBe("2026-10-05T10:00:00Z");
  });

  it("is null when there is nothing", () => {
    expect(earliest()).toBeNull();
    expect(earliest(null, null)).toBeNull();
  });

  it("compares instants, not strings, across offsets", () => {
    // 10:00+02:00 is 08:00Z, earlier than 09:00Z even though "10" sorts after "09".
    expect(earliest("2026-10-05T09:00:00Z", "2026-10-05T10:00:00+02:00")).toBe("2026-10-05T10:00:00+02:00");
  });
});

describe("timeToFirstEnquiry", () => {
  const created = "2026-10-01T12:00:00Z";

  it("says same day within 24 hours", () => {
    expect(timeToFirstEnquiry(created, "2026-10-01T23:59:00Z")).toBe("Same day");
  });

  it("counts whole days, rounded down", () => {
    expect(timeToFirstEnquiry(created, "2026-10-02T12:00:00Z")).toBe("1 day");
    expect(timeToFirstEnquiry(created, "2026-10-06T11:00:00Z")).toBe("4 days");
  });

  it("never goes negative if the clocks disagree", () => {
    expect(timeToFirstEnquiry(created, "2026-09-30T12:00:00Z")).toBe("Same day");
  });
});
