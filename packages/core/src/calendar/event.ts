import { createHash } from "node:crypto";
import { answersOf, CONCERNS, HANDOVER } from "../booking/answers";
import { formatPence } from "../booking/config";
import { zonedTimeToUtc } from "../booking/time";

// What a booking looks like as a Google Calendar event, and which of the
// calendar's own events count as busy. No database or network: sync.ts does
// the reading and writing.

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  // Write job events, and read every event for busy times and edits.
  "https://www.googleapis.com/auth/calendar.events",
  // The calendar picker for each van.
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
];

// Kept in Google. Held is a checkout in progress; cancelled and expired go.
export const EVENT_STATUSES = ["requested", "confirmed", "completed", "no_show"] as const;

export function hasEvent(status: string) {
  return (EVENT_STATUSES as readonly string[]).includes(status);
}

// Google event ids are 5-1024 characters of a-v and 0-9. One per booking, so
// writing it twice can't make two events.
export function eventIdFor(bookingId: string) {
  return `bk${bookingId.replace(/-/g, "").toLowerCase()}`;
}

// Marks our events, so they're never read back as busy time.
const BOOKING_KEY = "bookingId";

export type JobFacts = {
  bookingId: string;
  status: string;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  service: string | null;
  customer: { name: string | null; phone: string | null; email: string | null } | null;
  vehicle: { make: string | null; model: string | null; registration: string | null } | null;
  locationType: string;
  addressLine: string | null;
  postcode: string | null;
  resourceName: string | null;
  customerNotes: string | null;
  quoteSnapshot: unknown;
  pricePence: number;
  depositPence: number;
  depositStatus: string;
  // The booking's page in the dashboard.
  link: string;
};

export type EventBody = {
  summary: string;
  location?: string;
  description: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  status: "confirmed";
  transparency: "opaque";
  colorId?: string;
  extendedProperties: { private: Record<string, string> };
  reminders: { useDefault: true };
};

const PREFIX: Record<string, string> = {
  requested: "Awaiting approval: ",
  no_show: "No-show: ",
  completed: "Done: ",
};

// Google's event colours: banana for waiting on the owner, graphite for a no-show.
const COLOUR: Record<string, string> = { requested: "5", no_show: "8" };

const YES_NO: Record<string, string> = { yes: "Yes", no: "No", unsure: "Not sure" };
const PARKING: Record<string, string> = {
  driveway: "Driveway",
  street: "On the street",
  car_park: "Car park",
  other: "Other",
};

const DEPOSIT: Record<string, string> = {
  paid: "paid",
  pending: "not paid yet",
  refunded: "refunded",
  partially_refunded: "partly refunded",
  disputed: "disputed",
  waived: "waived",
};

// Everything the tech needs on their phone: who, where, what car, how to get
// to it, and a link to the booking for the rest.
export function jobEvent(f: JobFacts): EventBody {
  const answers = answersOf(f.quoteSnapshot);
  const details = answers?.details;
  const access = answers?.access;
  const name = f.customer?.name?.trim() || "Customer";
  const service = f.service?.trim() || "Booking";

  const car = [
    [f.vehicle?.make, f.vehicle?.model].filter(Boolean).join(" "),
    f.vehicle?.registration ? `(${f.vehicle.registration})` : "",
    details?.colour ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  const accessParts = [
    access?.water && `Water: ${YES_NO[access.water] ?? access.water}`,
    access?.power && `Power: ${YES_NO[access.power] ?? access.power}`,
    access?.parking && `Parking: ${PARKING[access.parking] ?? access.parking}`,
    access?.carLocation && `Car: ${access.carLocation}`,
  ].filter(Boolean);
  const concerns = (details?.concerns ?? []).map((c) => CONCERNS[c]).filter(Boolean);
  const deposit =
    f.depositPence > 0 ? ` · Deposit ${formatPence(f.depositPence)} ${DEPOSIT[f.depositStatus] ?? f.depositStatus}` : "";
  const address = [f.addressLine, f.postcode].filter(Boolean).join(", ");

  const lines = [
    `Customer: ${name}`,
    f.customer?.phone && `Phone: ${f.customer.phone}`,
    f.customer?.email && `Email: ${f.customer.email}`,
    car && `Car: ${car}`,
    f.resourceName && `Van: ${f.resourceName}`,
    f.locationType === "unit" ? "At the shop" : address && `Address: ${address}`,
    details?.handover && `Handover: ${HANDOVER[details.handover]}`,
    accessParts.length > 0 && accessParts.join(" · "),
    concerns.length > 0 && `To look at: ${concerns.join(", ")}`,
    f.customerNotes?.trim() && `Notes: ${f.customerNotes.trim()}`,
    `Price: ${formatPence(f.pricePence)}${deposit}`,
    "",
    `Booking: ${f.link}`,
    "",
    "Kept in step with your bookings. Change the booking there: changes made to this event are put back.",
  ].filter((l): l is string => typeof l === "string");

  return {
    summary: `${PREFIX[f.status] ?? ""}${service} · ${name}`,
    ...(address && { location: address }),
    description: lines.join("\n"),
    start: { dateTime: new Date(f.startsAt).toISOString(), timeZone: f.timeZone },
    end: { dateTime: new Date(f.endsAt).toISOString(), timeZone: f.timeZone },
    status: "confirmed",
    transparency: "opaque",
    ...(COLOUR[f.status] && { colorId: COLOUR[f.status] }),
    extendedProperties: { private: { [BOOKING_KEY]: f.bookingId } },
    reminders: { useDefault: true },
  };
}

// What was written, where: the same booking on the same calendar with the
// same hash needs no write.
export function eventHash(calendarId: string, body: EventBody) {
  return createHash("sha256").update(calendarId).update("\n").update(JSON.stringify(body)).digest("hex").slice(0, 32);
}

// ------------------------------------------------------------- reading Google

type When = { dateTime?: string; date?: string; timeZone?: string };

// The parts of a Google event that matter here.
export type GoogleEvent = {
  id: string;
  status?: string;
  start?: When;
  end?: When;
  transparency?: string;
  eventType?: string;
  attendees?: { self?: boolean; responseStatus?: string }[];
  extendedProperties?: { private?: Record<string, string> };
};

export function bookingIdOf(event: GoogleEvent): string | null {
  return event.extendedProperties?.private?.[BOOKING_KEY] ?? null;
}

// An all-day event's dates are in the calendar's own zone.
function instantOf(when: When | undefined, timeZone: string): Date | null {
  if (when?.dateTime) return new Date(when.dateTime);
  if (when?.date) return zonedTimeToUtc(when.date, "00:00", timeZone);
  return null;
}

// Neither busy for a person nor a reason to turn a customer away.
const NOT_BUSY_TYPES = new Set(["workingLocation", "birthday"]);

export type BusyRow = { event_id: string; starts_at: string; ends_at: string };

// The calendar's events that make its vans busy: not ours, not deleted, not
// shown as "free" (Google's default for all-day events), and not declined.
export function busyFromEvents(events: GoogleEvent[], timeZone: string): BusyRow[] {
  const rows: BusyRow[] = [];
  for (const e of events) {
    if (e.status === "cancelled" || bookingIdOf(e)) continue;
    if (e.transparency === "transparent" || (e.eventType && NOT_BUSY_TYPES.has(e.eventType))) continue;
    if (e.attendees?.some((a) => a.self && a.responseStatus === "declined")) continue;
    const start = instantOf(e.start, e.start?.timeZone ?? timeZone);
    const end = instantOf(e.end, e.end?.timeZone ?? timeZone);
    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) continue;
    rows.push({ event_id: e.id, starts_at: start.toISOString(), ends_at: end.toISOString() });
  }
  return rows;
}

// Whether someone has moved or deleted a job's event in Google.
export function changedInGoogle(event: GoogleEvent, booking: { startsAt: string; endsAt: string }) {
  if (event.status === "cancelled") return true;
  const start = event.start?.dateTime ? new Date(event.start.dateTime).getTime() : NaN;
  const end = event.end?.dateTime ? new Date(event.end.dateTime).getTime() : NaN;
  return start !== new Date(booking.startsAt).getTime() || end !== new Date(booking.endsAt).getTime();
}
