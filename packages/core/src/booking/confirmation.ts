// What the customer's confirmation page works out: the reference, what's left
// to pay, and the booking as a calendar entry. Pure.

// The short form of a booking's id, the same one the dashboard shows.
export function bookingReference(id: string) {
  return id.slice(0, 8).toUpperCase();
}

// Only a deposit that has actually been paid comes off the price.
export function amountsDue(booking: { pricePence: number; depositPence: number; depositStatus: string }) {
  const paidPence = booking.depositStatus === "paid" ? booking.depositPence : 0;
  return { paidPence, balancePence: Math.max(0, booking.pricePence - paidPence) };
}

export type CalendarEntry = {
  // Stable per booking, so adding it twice updates rather than duplicates.
  id: string;
  title: string;
  start: Date;
  end: Date;
  location: string;
  details: string;
};

// 2026-10-24T09:30:00.000Z → 20261024T093000Z
const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function googleCalendarUrl(entry: CalendarEntry) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: entry.title,
    dates: `${stamp(entry.start)}/${stamp(entry.end)}`,
    location: entry.location,
    details: entry.details,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

const escapeIcs = (text: string) => text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

// A calendar file's lines stop at 75 bytes; longer ones carry on after a space.
function fold(line: string) {
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = new TextEncoder().encode(char).length;
    if (bytes + size > 75) {
      parts.push(current);
      current = " ";
      bytes = 1;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n");
}

// An .ics file, for Apple Calendar, Outlook and the rest.
export function icsFile(entry: CalendarEntry, now = new Date()) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${entry.id}@booking`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(entry.start)}`,
    `DTEND:${stamp(entry.end)}`,
    `SUMMARY:${escapeIcs(entry.title)}`,
    `LOCATION:${escapeIcs(entry.location)}`,
    `DESCRIPTION:${escapeIcs(entry.details)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ]
    .map(fold)
    .join("\r\n");
}
