import { describe, expect, it } from "vitest";
import { countByWeek, monthlyPence, planGroup, sortAttention, trialEndsSoon, weekBuckets, type AttentionItem } from "./overview-rules";

describe("planGroup", () => {
  it("groups Stripe's statuses", () => {
    expect(planGroup(null)).toBe("manual");
    expect(planGroup("active")).toBe("paying");
    expect(planGroup("trialing")).toBe("trial");
    expect(planGroup("past_due")).toBe("problem");
    expect(planGroup("unpaid")).toBe("problem");
    expect(planGroup("awaiting_checkout")).toBe("signup");
    expect(planGroup("canceled")).toBe("ended");
    expect(planGroup("incomplete_expired")).toBe("ended");
    expect(planGroup("paused")).toBe("paused");
  });
});

describe("trialEndsSoon", () => {
  const now = new Date("2026-11-22T12:00:00Z");
  it("is true within the window and false outside it", () => {
    expect(trialEndsSoon("2026-11-25T12:00:00Z", now)).toBe(true);
    expect(trialEndsSoon("2026-12-05T12:00:00Z", now)).toBe(false);
    expect(trialEndsSoon("2026-11-20T12:00:00Z", now)).toBe(false);
    expect(trialEndsSoon(null, now)).toBe(false);
  });
});

describe("monthlyPence", () => {
  it("turns any interval into a month", () => {
    expect(monthlyPence(4900, "month")).toBe(4900);
    expect(monthlyPence(4900, "month", 3)).toBe(1633);
    expect(monthlyPence(58800, "year")).toBe(4900);
    expect(monthlyPence(1200, "week")).toBe(5200);
  });
});

describe("weekBuckets", () => {
  it("starts each week on a Monday and ends with this one", () => {
    // A Sunday.
    const buckets = weekBuckets(new Date("2026-11-22T10:00:00Z"), 3);
    expect(buckets.map((b) => b.start.toISOString().slice(0, 10))).toEqual(["2026-11-02", "2026-11-09", "2026-11-16"]);
  });

  it("counts times into their week and drops older ones", () => {
    const buckets = weekBuckets(new Date("2026-11-22T10:00:00Z"), 2);
    expect(
      countByWeek(buckets, ["2026-11-01T00:00:00Z", "2026-11-09T00:00:00Z", "2026-11-15T23:59:00Z", "2026-11-16T00:00:00Z"]),
    ).toEqual([2, 1]);
  });
});

describe("sortAttention", () => {
  const item = (kind: AttentionItem["kind"], urgent: boolean, name: string): AttentionItem => ({
    kind,
    urgent,
    tenant: { name, slug: name },
    detail: "",
  });

  it("puts urgent items first, then by kind, then by name", () => {
    const sorted = sortAttention([
      item("domain_unverified", false, "B"),
      item("trial_ending", false, "A"),
      item("email_failures", true, "C"),
      item("payment_failed", true, "D"),
    ]);
    expect(sorted.map((i) => i.tenant.name)).toEqual(["D", "C", "A", "B"]);
  });
});
