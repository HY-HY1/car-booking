import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/urls", () => ({
  appUrl: (path = "/", opts?: { absolute?: boolean }) => (opts?.absolute ? `https://app.example.com${path}` : path),
  adminUrl: (path = "/") => `https://admin.example.com${path}`,
}));

const { safeNext } = await import("./safe-next");

describe("safeNext", () => {
  it("keeps our own paths and hosts", () => {
    expect(safeNext("/shine/bookings?view=week")).toBe("/shine/bookings?view=week");
    expect(safeNext("https://app.example.com/shine")).toBe("https://app.example.com/shine");
    expect(safeNext("https://admin.example.com/tenants")).toBe("https://admin.example.com/tenants");
  });

  it.each([
    "/\t/evil.com",
    "/\n/evil.com",
    "/\r/evil.com",
    "//evil.com",
    "/\\evil.com",
    "\\\\evil.com",
    "https://evil.com",
    "https://app.example.com.evil.com/",
    "javascript:alert(1)",
    " //evil.com",
  ])("falls back for %j", (value) => {
    expect(safeNext(value, "/fallback")).toBe("/fallback");
  });

  it("falls back for anything that isn't a string", () => {
    expect(safeNext(undefined, "/fallback")).toBe("/fallback");
    expect(safeNext(["/a"], "/fallback")).toBe("/fallback");
  });
});
