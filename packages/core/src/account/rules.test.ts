import { describe, expect, it } from "vitest";
import { awaitingSecondFactor, cleanCode, RESET_COOLDOWN_MS, resetAllowed } from "./rules";

describe("awaitingSecondFactor", () => {
  it("asks for a code after a password when two-factor is on", () => {
    expect(awaitingSecondFactor({ currentLevel: "aal1", nextLevel: "aal2" })).toBe(true);
  });

  it("leaves someone who has entered their code alone", () => {
    expect(awaitingSecondFactor({ currentLevel: "aal2", nextLevel: "aal2" })).toBe(false);
  });

  it("leaves someone without two-factor alone", () => {
    expect(awaitingSecondFactor({ currentLevel: "aal1", nextLevel: "aal1" })).toBe(false);
  });

  it("doesn't ask anyone signed out", () => {
    expect(awaitingSecondFactor({ currentLevel: null, nextLevel: null })).toBe(false);
    expect(awaitingSecondFactor(null)).toBe(false);
  });
});

describe("cleanCode", () => {
  it("accepts six digits, with or without a space", () => {
    expect(cleanCode("123456")).toBe("123456");
    expect(cleanCode(" 123 456 ")).toBe("123456");
  });

  it("refuses anything else", () => {
    for (const bad of ["12345", "1234567", "abcdef", "", null, undefined]) expect(cleanCode(bad)).toBeNull();
  });
});

describe("resetAllowed", () => {
  const now = new Date("2026-11-10T12:00:00Z");

  it("allows a first request", () => {
    expect(resetAllowed(null, now)).toBe(true);
  });

  it("refuses another inside the cooldown", () => {
    expect(resetAllowed(new Date(now.getTime() - RESET_COOLDOWN_MS + 1000).toISOString(), now)).toBe(false);
  });

  it("allows another once the cooldown is over", () => {
    expect(resetAllowed(new Date(now.getTime() - RESET_COOLDOWN_MS).toISOString(), now)).toBe(true);
  });
});
