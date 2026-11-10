import { describe, expect, it } from "vitest";
import { can } from "../team/access";
import { parseActivityArea } from "./rules";

describe("parseActivityArea", () => {
  it("accepts a known area", () => {
    expect(parseActivityArea("booking")).toBe("booking");
  });

  it("refuses anything else, including object built-ins", () => {
    for (const bad of ["nope", "constructor", "", null, undefined, ["booking"]]) expect(parseActivityArea(bad)).toBeNull();
  });
});

describe("who can read the activity log", () => {
  it("is owners and managers only", () => {
    expect(can("owner", "activity.view")).toBe(true);
    expect(can("manager", "activity.view")).toBe(true);
    expect(can("staff", "activity.view")).toBe(false);
    expect(can("technician", "activity.view")).toBe(false);
  });
});
