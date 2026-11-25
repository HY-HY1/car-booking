import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";

vi.mock("server-only", () => ({}));
const { makeTabIcon, resizeTabIcon } = await import("./tab-icon");

// A plain picture of the given size, as a PNG.
const picture = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 200, g: 40, b: 40 } } }).png().toBuffer();

describe("tab icon", () => {
  it("stores any upload as an exact 512px square PNG, cropping a wide or tall one", async () => {
    for (const [w, h] of [[1200, 400], [300, 900], [64, 64]]) {
      const meta = await sharp(await makeTabIcon(await picture(w, h))).metadata();
      expect([meta.format, meta.width, meta.height]).toEqual(["png", 512, 512]);
    }
  });

  it("serves it at each size asked for, still square", async () => {
    const stored = await makeTabIcon(await picture(800, 600));
    for (const size of [32, 180, 192]) {
      const meta = await sharp(await resizeTabIcon(stored, size)).metadata();
      expect([meta.width, meta.height]).toEqual([size, size]);
    }
  });
});
