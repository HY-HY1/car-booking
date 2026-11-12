import type { DayKey, WeeklyHours } from "./config";

// Opening hours as a customer reads them: Monday first, days with the same
// hours run together ("Mon – Fri", "9am – 5pm"), closed days said so. Used on
// the booking page's home.

const WEEK: { key: DayKey; label: string }[] = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

// "09:00" -> "9am", "17:30" -> "5:30pm", "12:00" -> "12pm".
export function clockText(time: string) {
  const [h, m] = time.split(":").map(Number);
  const suffix = h < 12 ? "am" : "pm";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}${m ? `:${String(m).padStart(2, "0")}` : ""}${suffix}`;
}

function dayHours(hours: WeeklyHours, day: DayKey) {
  const spans = hours[day] ?? [];
  return spans.length ? spans.map(([open, close]) => `${clockText(open)} – ${clockText(close)}`).join(", ") : "Closed";
}

export function openingHoursLines(hours: WeeklyHours): { days: string; hours: string }[] {
  const lines: { from: string; to: string; hours: string }[] = [];
  for (const { key, label } of WEEK) {
    const text = dayHours(hours, key);
    const last = lines.at(-1);
    if (last && last.hours === text) last.to = label;
    else lines.push({ from: label, to: label, hours: text });
  }
  return lines.map((l) => ({ days: l.from === l.to ? l.from : `${l.from} – ${l.to}`, hours: l.hours }));
}

// Two sets of hours are the same if every day reads the same.
export function sameHours(a: WeeklyHours, b: WeeklyHours) {
  return WEEK.every(({ key }) => dayHours(a, key) === dayHours(b, key));
}
