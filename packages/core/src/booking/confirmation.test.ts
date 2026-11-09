import { describe, expect, it } from "vitest";
import { amountsDue, bookingReference, googleCalendarUrl, icsFile, type CalendarEntry } from "./confirmation";

const entry: CalendarEntry = {
  id: "abc",
  title: "Full valet with Shine, Bristol",
  start: new Date("2026-10-24T08:30:00Z"),
  end: new Date("2026-10-24T11:00:00Z"),
  location: "12 High Street, BS1 4DJ",
  details: "Reference ABC\nCall 07700 900123",
};

describe("the confirmation page", () => {
  it("shortens the id as the dashboard does", () => {
    expect(bookingReference("0a1b2c3d-1111-4111-8111-111111111111")).toBe("0A1B2C3D");
  });

  it("only takes a paid deposit off the balance", () => {
    expect(amountsDue({ pricePence: 12500, depositPence: 2500, depositStatus: "paid" })).toEqual({ paidPence: 2500, balancePence: 10000 });
    expect(amountsDue({ pricePence: 12500, depositPence: 2500, depositStatus: "pending" })).toEqual({ paidPence: 0, balancePence: 12500 });
    expect(amountsDue({ pricePence: 12500, depositPence: 12500, depositStatus: "paid" }).balancePence).toBe(0);
  });

  it("links to Google Calendar with the times in UTC", () => {
    const url = new URL(googleCalendarUrl(entry));
    expect(url.searchParams.get("dates")).toBe("20261024T083000Z/20261024T110000Z");
    expect(url.searchParams.get("text")).toBe(entry.title);
    expect(url.searchParams.get("location")).toBe(entry.location);
  });

  it("escapes a calendar file's text", () => {
    const file = icsFile(entry, new Date("2026-10-01T00:00:00Z"));
    expect(file).toContain("DTSTART:20261024T083000Z");
    expect(file).toContain("DTSTAMP:20261001T000000Z");
    expect(file).toContain("SUMMARY:Full valet with Shine\\, Bristol");
    expect(file).toContain("DESCRIPTION:Reference ABC\\nCall 07700 900123");
    expect(file.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(file.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("folds long lines at 75 bytes", () => {
    const file = icsFile({ ...entry, details: "x".repeat(300) });
    for (const line of file.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(file.replace(/\r\n /g, "")).toContain(`DESCRIPTION:${"x".repeat(300)}`);
  });
});
