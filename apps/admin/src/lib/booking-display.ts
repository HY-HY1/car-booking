import { CONCERNS, CONTACT_METHODS, HANDOVER, HEARD_FROM, type StoredAnswers } from "@leadgen/core/booking/answers";
import type { ConditionCheck } from "@leadgen/core/booking/condition";

// How booking data is labelled and read for display, shared by the bookings
// list and the booking page.

export const BOOKING_STATUS: Record<string, string> = {
  held: "Held",
  requested: "Awaiting approval",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
  expired: "Hold expired",
};

export const BOOKING_STATUS_TONE: Record<string, string> = {
  held: "bg-amber-100 text-amber-900",
  requested: "bg-violet-100 text-violet-900",
  confirmed: "bg-emerald-100 text-emerald-900",
  completed: "bg-sky-100 text-sky-900",
  cancelled: "bg-muted text-muted-foreground",
  no_show: "bg-red-100 text-red-900",
  expired: "bg-muted text-muted-foreground",
};

export const DEPOSIT_STATUS: Record<string, string> = {
  none: "No deposit",
  pending: "Deposit due",
  paid: "Deposit paid",
  refunded: "Refunded",
  partially_refunded: "Partly refunded",
  disputed: "Disputed",
  waived: "Waived",
};

export const BOOKING_SOURCE: Record<string, string> = { booking_page: "Booking page" };

const YES_NO: Record<string, string> = { yes: "Yes", no: "No", unsure: "Not sure" };
const PARKING: Record<string, string> = {
  driveway: "Driveway",
  street: "On the street",
  car_park: "Car park",
  other: "Other",
};
export const SIZE_NAME: Record<string, string> = { small: "Small", medium: "Medium", large: "Large", xl: "XL" };

export type QuoteLine = { label: string; amount_pence: number };

// The quote is frozen json, so each part is checked before it's shown.
export function quoteOf(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== "object") return null;
  const q = snapshot as Record<string, unknown>;
  const lines = Array.isArray(q.lines)
    ? q.lines.filter(
        (l): l is QuoteLine =>
          !!l &&
          typeof l === "object" &&
          typeof (l as QuoteLine).label === "string" &&
          typeof (l as QuoteLine).amount_pence === "number",
      )
    : [];
  return {
    lines,
    durationMins: typeof q.duration_mins === "number" ? q.duration_mins : null,
    needsInspection: q.needs_inspection === true,
    condition: conditionOf(q.condition),
  };
}

const CHECK_RESULTS: ConditionCheck["result"][] = ["assessed", "unsure", "failed", "not_checked"];

// How the car's condition was decided from its photos. Quotes made before
// photo checks (or for a business that doesn't price by condition) have none.
function conditionOf(value: unknown): ConditionCheck | null {
  if (!value || typeof value !== "object") return null;
  const c = value as Record<string, unknown>;
  if (!CHECK_RESULTS.includes(c.result as ConditionCheck["result"])) return null;
  const text = (v: unknown) => (typeof v === "string" && v ? v : null);
  return {
    result: c.result as ConditionCheck["result"],
    key: text(c.key),
    label: text(c.label),
    confidence: typeof c.confidence === "number" ? c.confidence : null,
    summary: text(c.summary),
  };
}

// The "can we use a tap / socket / where's the car" answers, labelled, with
// anything not answered left out.
export function accessRowsOf(access: Record<string, unknown> | null): [string, string][] {
  const a = access ?? {};
  return [
    ["Outside tap", YES_NO[String(a.water)]],
    ["Power socket", YES_NO[String(a.power)]],
    ["Parking", PARKING[String(a.parking)]],
    ["Car location", typeof a.carLocation === "string" ? a.carLocation : undefined],
  ].filter((row): row is [string, string] => Boolean(row[1]));
}

export type SubmittedGroup = { title: string; rows: [string, string][] };

function label<T extends Record<string, string>>(map: T, key: string | undefined) {
  return key ? (map[key] ?? key) : undefined;
}

// Everything the customer filled in on the booking page, grouped for display.
// A booking has its own columns for some of it (vehicle row, access notes,
// notes) and the lead only has the snapshot, so each can be passed and the
// columns win where both exist. Anything not answered is left out.
export function submittedGroups(input: {
  answers: StoredAnswers | null;
  vehicle?: { make: string | null; model: string | null; registration: string | null; size_class: string | null } | null;
  access?: Record<string, unknown> | null;
  notes?: string | null;
  postcode?: string | null;
  addressLine?: string | null;
  locationType?: "mobile" | "unit";
  marketing?: boolean;
}): SubmittedGroup[] {
  const { answers } = input;
  const d = answers?.details;
  const car =
    [input.vehicle?.make ?? answers?.vehicle?.make, input.vehicle?.model ?? answers?.vehicle?.model]
      .filter(Boolean)
      .join(" ") || undefined;
  const size = input.vehicle?.size_class;
  const access = input.access ?? answers?.access ?? null;
  const notes = input.notes ?? answers?.notes;
  const where =
    input.locationType === "unit"
      ? "Dropping it off at your unit"
      : [input.addressLine, input.postcode].filter(Boolean).join(", ") || undefined;

  const groups: SubmittedGroup[] = [
    {
      title: "Vehicle",
      rows: [
        ["Car", car],
        ["Registration", input.vehicle?.registration ?? answers?.vehicle?.registration],
        ["Colour", d?.colour],
        ["Year", d?.year ? String(d.year) : undefined],
        ["Size", size ? (SIZE_NAME[size] ?? size) : undefined],
        ["Needs a look at", d?.concerns?.length ? d.concerns.map((c) => label(CONCERNS, c)).join(", ") : undefined],
      ],
    },
    {
      title: "Location",
      rows: [
        ["Address", where],
        ...accessRowsOf(access),
        ["Handover", label(HANDOVER, d?.handover)],
      ],
    },
    {
      title: "Preferences",
      rows: [
        ["Contact by", label(CONTACT_METHODS, d?.contactMethod)],
        ["Found us via", label(HEARD_FROM, d?.heardFrom)],
        ["Time", d?.flexible ? "Flexible: tell them if an earlier time opens up" : undefined],
        ["Marketing", input.marketing === undefined ? undefined : input.marketing ? "Opted in to emails" : "Not opted in"],
      ],
    },
    {
      title: "Their message",
      rows: [["Notes", notes || undefined]],
    },
    {
      title: "Consent",
      rows: [["Details confirmed", answers?.termsAcceptedAt ? formatStamp(answers.termsAcceptedAt) : undefined]],
    },
  ].map((g) => ({
    title: g.title,
    rows: g.rows.filter((r): r is [string, string] => Boolean(r[1])),
  }));
  return groups.filter((g) => g.rows.length > 0);
}

function formatStamp(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(new Date(iso));
}
