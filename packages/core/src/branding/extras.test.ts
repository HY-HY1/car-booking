import { describe, expect, it } from "vitest";
import { extrasFormSchema } from "../settings/forms";
import { DEFAULT_POLICY } from "../settings/policy";
import { EXTRAS_DEFAULTS, extrasSchema, jobsCountText, policyLineText, policySummary, roundedDown } from "./extras";

const policy = (over: Partial<typeof DEFAULT_POLICY> = {}) => ({ ...DEFAULT_POLICY, ...over });

describe("booking page extras", () => {
  it("reads nothing stored as the defaults", () => {
    expect(extrasSchema.parse(undefined)).toEqual(EXTRAS_DEFAULTS);
    expect(extrasSchema.parse({ jobs_count: { show: true, label: "", before: -4 } }).jobs_count).toEqual({
      show: true,
      label: "jobs completed",
      before: 0,
    });
  });
});

describe("deposit and cancellation line", () => {
  it("sums up the deposit and when cancelling is free", () => {
    expect(policySummary({ type: "fixed", value_pence: 2000 }, policy({ cutoff_hours: 48 }))).toBe("£20 deposit · free cancellation up to 2 days before");
    expect(policySummary({ type: "percent", value: 25 }, policy())).toBe("25% deposit · free cancellation up to 24 hours before");
    expect(policySummary({ type: "none" }, policy({ cutoff_hours: 0 }))).toBe("No deposit · free cancellation any time");
    expect(policySummary({ type: "full" }, policy({ refund_before_cutoff: "none" }))).toBe("Pay when you book · non-refundable");
    expect(policySummary({ type: "fixed", value_pence: 1500 }, policy({ refund_before_cutoff: "none" }))).toBe("£15 deposit · deposit non-refundable");
    expect(policySummary({ type: "none" }, null)).toBe("No deposit");
  });

  it("uses the owner's wording when they've written one, and nothing when off", () => {
    const own = { ...EXTRAS_DEFAULTS, policy_line: { show: true, text: "Small deposit, easy to move" } };
    expect(policyLineText(own, { type: "none" }, null)).toBe("Small deposit, easy to move");
    expect(policyLineText({ ...EXTRAS_DEFAULTS, policy_line: { show: false } }, { type: "none" }, null)).toBeNull();
  });
});

describe("jobs completed count", () => {
  it("rounds down to a tidy figure", () => {
    expect([roundedDown(72), roundedDown(437), roundedDown(1262)]).toEqual([70, 400, 1200]);
  });

  it("adds jobs from before, and stays hidden while off or under the minimum", () => {
    const on = { ...EXTRAS_DEFAULTS, jobs_count: { show: true, label: "cars cleaned", before: 400 } };
    expect(jobsCountText(on, 37)).toBe("400+ cars cleaned");
    expect(jobsCountText({ ...on, jobs_count: { ...on.jobs_count, before: 0 } }, 49)).toBeNull();
    expect(jobsCountText({ ...on, jobs_count: { ...on.jobs_count, show: false } }, 900)).toBeNull();
    expect(jobsCountText(on, 1000)).toBe("1,400+ cars cleaned");
  });
});

describe("trust and enquiries form", () => {
  it("parses the switches and wording, blanks as defaults", () => {
    expect(
      extrasFormSchema.parse({ policy_show: "on", policy_text: "", jobs_show: "on", jobs_label: "", jobs_before: "1,200", enquiries_intro: " Fleet? Ask us. " }),
    ).toEqual({
      policy_line: { show: true },
      jobs_count: { show: true, label: "jobs completed", before: 1200 },
      enquiries: { show: false, intro: "Fleet? Ask us." },
    });
    expect(extrasFormSchema.safeParse({ jobs_before: "lots" }).success).toBe(false);
  });
});
