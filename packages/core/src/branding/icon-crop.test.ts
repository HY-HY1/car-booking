import { describe, expect, it } from "vitest";
import { iconSize, squareCrop } from "./icon-crop";

describe("tab icon crop", () => {
  it("takes the largest centred square at zoom 1", () => {
    expect(squareCrop(1200, 600, 1, { x: 0.5, y: 0.5 })).toEqual({ sx: 300, sy: 0, side: 600, centre: { x: 0.5, y: 0.5 } });
    expect(squareCrop(400, 1000, 1, { x: 0.5, y: 0.2 })).toEqual({ sx: 0, sy: 0, side: 400, centre: { x: 0.5, y: 0.2 } });
  });

  it("zooms in, and never lets the square run off the picture", () => {
    expect(squareCrop(1000, 1000, 2, { x: 0.25, y: 0.75 })).toEqual({ sx: 0, sy: 500, side: 500, centre: { x: 0.25, y: 0.75 } });
    const pushed = squareCrop(1000, 500, 2, { x: 1.4, y: -1 });
    expect(pushed).toEqual({ sx: 750, sy: 0, side: 250, centre: { x: 0.875, y: 0.25 } });
    expect(squareCrop(800, 800, 99, { x: 0.5, y: 0.5 }).side).toBe(160);
  });

  it("serves the sizes browsers ask for, the tab size otherwise", () => {
    expect([iconSize("180"), iconSize("512"), iconSize("33"), iconSize(null)]).toEqual([180, 512, 32, 32]);
  });
});
