// How dates and times are written across the dashboard and the booking pages,
// so the same moment reads the same everywhere. Pass the business's time zone
// where it's known. Emails have their own wording (email/compose.ts).

const LONDON = "Europe/London";

function format(iso: string | Date, timeZone: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone }).format(new Date(iso));
}

const CLOCK = { hour: "2-digit", minute: "2-digit" } as const;

// 14:30
export const formatTime = (iso: string | Date, timeZone = LONDON) => format(iso, timeZone, CLOCK);

// 9 Nov
export const formatShortDate = (iso: string | Date, timeZone = LONDON) =>
  format(iso, timeZone, { day: "numeric", month: "short" });

// 9 Nov 2026
export const formatDate = (iso: string | Date, timeZone = LONDON) =>
  format(iso, timeZone, { day: "numeric", month: "short", year: "numeric" });

// 9 Nov 2026, 14:30
export const formatDateTime = (iso: string | Date, timeZone = LONDON) =>
  format(iso, timeZone, { day: "numeric", month: "short", year: "numeric", ...CLOCK });

// Mon, 9 Nov, 14:30
export const formatDayTime = (iso: string | Date, timeZone = LONDON) =>
  format(iso, timeZone, { weekday: "short", day: "numeric", month: "short", ...CLOCK });

// Monday 9 November 2026
export const formatFullDate = (iso: string | Date, timeZone = LONDON) =>
  format(iso, timeZone, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

// Monday 9 November at 14:30
export const formatFullDateTime = (iso: string | Date, timeZone = LONDON) =>
  format(iso, timeZone, { weekday: "long", day: "numeric", month: "long", ...CLOCK });
