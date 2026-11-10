import { describe, expect, it } from "vitest";
import { parseCustomerCsv } from "./import-rules";

describe("parseCustomerCsv", () => {
  it("reads customers, matching column names loosely", () => {
    const result = parseCustomerCsv("Full Name,Email Address,Mobile,Post Code\nJo Doe,JO@EXAMPLE.COM,07700 900123,bs14dj\n");
    expect(result).toMatchObject({
      ok: true,
      customers: [{ name: "Jo Doe", email: "jo@example.com", postcode: "BS1 4DJ" }],
      skipped: [],
    });
  });

  it("needs a name column and a way to reach them", () => {
    expect(parseCustomerCsv("email\na@b.co")).toMatchObject({ ok: false });
    expect(parseCustomerCsv("name\nJo")).toMatchObject({ ok: false });
  });

  it("says which lines it skipped and why", () => {
    const result = parseCustomerCsv("name,email\n,a@b.co\nJo,not-an-email\nAl,al@b.co\nAl Again,AL@b.co\n");
    expect(result).toMatchObject({
      ok: true,
      customers: [{ name: "Al" }],
      skipped: [
        { line: 2, reason: "No name" },
        { line: 3, reason: "No valid email or phone" },
        { line: 5, reason: "Repeated in this file" },
      ],
    });
  });

  it("refuses an empty file", () => {
    expect(parseCustomerCsv("name,email\n")).toMatchObject({ ok: false });
  });
});
