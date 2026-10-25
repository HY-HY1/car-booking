import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { sniffImageType } = await import("./photos");

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

describe("sniffImageType", () => {
  it("recognises JPEG, PNG and WebP by their first bytes", () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a))).toBe("image/png");
    expect(sniffImageType(bytes(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP")))).toBe("image/webp");
  });

  it("rejects anything else, whatever it's called", () => {
    expect(sniffImageType(bytes(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WAVE")))).toBeNull();
    expect(sniffImageType(bytes(...ascii("%PDF-1.7")))).toBeNull();
    expect(sniffImageType(bytes(...ascii("<svg")))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
  });
});
