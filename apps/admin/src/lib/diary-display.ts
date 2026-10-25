import { longDate, shortDate } from "@leadgen/core/booking/calendar";
import { localDate, localTime } from "@leadgen/core/booking/time";

// How the diary words its dates and times. Everything is in the business's
// own time zone, never the viewer's.

export const clock = (iso: string | Date, timeZone: string) => localTime(new Date(iso), timeZone);

const MONTHS_SHORT = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });
const monthOf = (date: string) => MONTHS_SHORT.format(new Date(`${date}T12:00:00Z`));

export function viewLabel(view: "day" | "week", days: string[], today: string) {
  if (view === "day") {
    const date = days[0];
    if (date === today) return "Today";
    return `${shortDate(date)} ${date.slice(0, 4)}`;
  }
  const [first, last] = [days[0], days[days.length - 1]];
  if (days.includes(today)) return "This week";
  const day = (d: string) => String(Number(d.slice(8)));
  return first.slice(0, 7) === last.slice(0, 7)
    ? `${day(first)} to ${day(last)} ${monthOf(last)} ${last.slice(0, 4)}`
    : `${day(first)} ${monthOf(first)} to ${day(last)} ${monthOf(last)} ${last.slice(0, 4)}`;
}

// "Tue 20 Oct, all day", "Tue 20 to Fri 23 Oct, all day", "Tue 20 Oct, 09:00 to 13:00".
export function timeOffLabel(startIso: string, endIso: string, timeZone: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const startDate = localDate(start, timeZone);
  const startTime = localTime(start, timeZone);
  // The end is exclusive, so a block ending at midnight ends the day before.
  const endTime = localTime(end, timeZone);
  const lastDate = localDate(new Date(end.getTime() - 60_000), timeZone);

  if (startTime === "00:00" && endTime === "00:00") {
    return startDate === lastDate
      ? `${shortDate(startDate)}, all day`
      : `${shortDate(startDate)} to ${shortDate(lastDate)}, all day`;
  }
  const endDate = localDate(end, timeZone);
  return startDate === endDate
    ? `${shortDate(startDate)}, ${startTime} to ${endTime}`
    : `${shortDate(startDate)} ${startTime} to ${shortDate(endDate)} ${endTime}`;
}

export { longDate, shortDate };
