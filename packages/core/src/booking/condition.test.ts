import { describe, expect, it } from "vitest";
import type { ConditionTier } from "./config";
import {
  assessmentOutputSchema,
  assessmentPrompt,
  CANNOT_TELL,
  conditionCheck,
  decideAssessment,
  MIN_CONFIDENCE,
} from "./condition";

const tiers: ConditionTier[] = [
  { key: "light", label: "Light: regular wash, little dirt", multiplier: 1, extra_mins: 0, needs_inspection: false },
  { key: "heavy", label: "Heavy: pet hair, stains, mud", multiplier: 1.35, extra_mins: 60, needs_inspection: false },
  { key: "severe", label: "Severe: mould or biohazard", multiplier: 1, extra_mins: 0, needs_inspection: true },
];

describe("the model's answer", () => {
  it("only allows this business's levels, or cannot_tell", () => {
    const schema = assessmentOutputSchema(tiers);
    expect(schema.safeParse({ condition: "heavy", confidence: 0.9, summary: "Dog hair" }).success).toBe(true);
    expect(schema.safeParse({ condition: CANNOT_TELL, confidence: 0.2, summary: "Too dark" }).success).toBe(true);
    expect(schema.safeParse({ condition: "filthy", confidence: 0.9, summary: "" }).success).toBe(false);
  });

  it("lists every level in the prompt and marks the ones the owner prices", () => {
    const prompt = assessmentPrompt(tiers);
    for (const t of tiers) expect(prompt).toContain(`- ${t.key}: ${t.label}`);
    expect(prompt).toMatch(/severe: .*\(the owner prices this one after seeing the car\)/);
  });
});

describe("decideAssessment", () => {
  it("prices from a confident answer", () => {
    expect(decideAssessment({ condition: "heavy", confidence: 0.92, summary: " Dog hair on the back seats. " }, tiers)).toEqual({
      status: "assessed",
      conditionKey: "heavy",
      confidence: 0.92,
      summary: "Dog hair on the back seats.",
    });
  });

  it("is unsure below the threshold, or when the model can't tell", () => {
    expect(decideAssessment({ condition: "heavy", confidence: MIN_CONFIDENCE - 0.01, summary: "x" }, tiers).status).toBe("unsure");
    expect(decideAssessment({ condition: CANNOT_TELL, confidence: 0.99, summary: "Only the bonnet" }, tiers)).toMatchObject({
      status: "unsure",
      conditionKey: null,
    });
  });

  it("keeps confidence between 0 and 1", () => {
    expect(decideAssessment({ condition: "light", confidence: 7, summary: "" }, tiers)).toMatchObject({ confidence: 1, summary: null });
    expect(decideAssessment({ condition: "light", confidence: Number.NaN, summary: "" }, tiers).status).toBe("unsure");
  });
});

describe("conditionCheck", () => {
  const assessed = { id: "a", status: "assessed" as const, conditionKey: "heavy", confidence: 0.9, summary: "Mud" };

  it("is null when the business doesn't price by condition", () => {
    expect(conditionCheck([], assessed)).toBeNull();
  });

  it("records an unchecked quote", () => {
    expect(conditionCheck(tiers, null)).toMatchObject({ result: "not_checked", key: null });
  });

  it("keeps the level's label at the time", () => {
    expect(conditionCheck(tiers, assessed)).toMatchObject({ result: "assessed", key: "heavy", label: tiers[1].label });
  });

  it("treats a level removed since the check as unsure", () => {
    expect(conditionCheck(tiers.slice(0, 1), assessed)).toMatchObject({ result: "unsure", key: null, summary: "Mud" });
  });
});
