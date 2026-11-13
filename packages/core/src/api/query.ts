import { z } from "zod";
import { SIZE_CLASSES } from "../booking/config";
import { isUkPostcode } from "../booking/geo";
import { isIsoDate, zonedTimeToUtc } from "../booking/time";
import { normalizePhone, normalizePostcode } from "../customer-fields";
import type { BookingStatus, LeadStatus, SizeClass } from "./types";

// Reading the API's query strings and bodies, and its list cursors. Pure, so
// it's tested without a server (api.test.ts). Everything that comes back
// wrong names the parameter, so the error can say which one.

export type Parsed<T> = { ok: true; value: T } | { ok: false; param: string; message: string };

export const BOOKING_STATUSES: BookingStatus[] = ["requested", "confirmed", "completed", "cancelled", "no_show"];
export const LEAD_STATUSES: LeadStatus[] = ["new", "quoted", "booked", "lost"];
export const MAX_LIMIT = 100;
export const DEFAULT_LIMIT = 25;

const ok = <T>(value: T): Parsed<T> => ({ ok: true, value });
const bad = (param: string, message: string): Parsed<never> => ({ ok: false, param, message });

// ------------------------------------------------------------------ cursors

// A cursor is where the last page stopped: the sort value and the id of its
// last row, so rows added meanwhile don't shift what's next.
export type Cursor = { after: string; id: string };

export function encodeCursor(cursor: Cursor) {
  return Buffer.from(JSON.stringify([cursor.after, cursor.id])).toString("base64url");
}

export function decodeCursor(value: string): Cursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === "string" &&
      !Number.isNaN(Date.parse(parsed[0])) &&
      z.uuid().safeParse(parsed[1]).success
    ) {
      return { after: parsed[0], id: parsed[1] };
    }
  } catch {}
  return null;
}

// ------------------------------------------------------------------ single values

function one(params: URLSearchParams, name: string) {
  const value = params.get(name);
  return value === null || value.trim() === "" ? undefined : value.trim();
}

function limitOf(params: URLSearchParams): Parsed<number> {
  const raw = one(params, "limit");
  if (raw === undefined) return ok(DEFAULT_LIMIT);
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > MAX_LIMIT) return bad("limit", `limit must be a whole number from 1 to ${MAX_LIMIT}.`);
  return ok(n);
}

function cursorOf(params: URLSearchParams): Parsed<Cursor | null> {
  const raw = one(params, "cursor");
  if (raw === undefined) return ok(null);
  const cursor = decodeCursor(raw);
  return cursor ? ok(cursor) : bad("cursor", "That cursor isn't valid. Use nextCursor from the last page, unchanged.");
}

// A date-time with an offset, or a plain date taken as midnight where the
// business is.
function instantOf(params: URLSearchParams, name: string, timeZone: string, dateAllowed = true): Parsed<string | undefined> {
  const raw = one(params, name);
  if (raw === undefined) return ok(undefined);
  if (dateAllowed && isIsoDate(raw)) return ok(zonedTimeToUtc(raw, "00:00", timeZone).toISOString());
  if (z.iso.datetime({ offset: true }).safeParse(raw).success) return ok(new Date(raw).toISOString());
  return bad(
    name,
    dateAllowed
      ? `${name} must be a date (2026-11-20) or a date and time with a time zone (2026-11-20T09:00:00Z).`
      : `${name} must be a date and time with a time zone, such as 2026-11-20T09:00:00Z.`,
  );
}

function uuidOf(params: URLSearchParams, name: string): Parsed<string | undefined> {
  const raw = one(params, name);
  if (raw === undefined) return ok(undefined);
  return z.uuid().safeParse(raw).success ? ok(raw) : bad(name, `${name} must be an id (a UUID).`);
}

function listOf<T extends string>(params: URLSearchParams, name: string, allowed: readonly T[]): Parsed<T[] | undefined> {
  const raw = one(params, name);
  if (raw === undefined) return ok(undefined);
  const values = [...new Set(raw.split(",").map((v) => v.trim()).filter(Boolean))];
  const unknown = values.find((v) => !allowed.includes(v as T));
  if (unknown !== undefined) return bad(name, `"${unknown}" isn't a ${name}. Use any of: ${allowed.join(", ")}.`);
  return ok(values as T[]);
}

// Runs each parser in turn and stops at the first problem.
function all<T extends Record<string, unknown>>(parts: { [K in keyof T]: Parsed<T[K]> }): Parsed<T> {
  const value = {} as T;
  for (const key of Object.keys(parts) as (keyof T)[]) {
    const part = parts[key];
    if (!part.ok) return part;
    value[key] = part.value;
  }
  return ok(value);
}

// ------------------------------------------------------------------ list queries

export type BookingListParams = {
  status?: BookingStatus[];
  from?: string;
  to?: string;
  updatedSince?: string;
  customerId?: string;
  limit: number;
  cursor: Cursor | null;
};

export function parseBookingList(params: URLSearchParams, timeZone: string): Parsed<BookingListParams> {
  return all<BookingListParams>({
    status: listOf(params, "status", BOOKING_STATUSES),
    from: instantOf(params, "from", timeZone),
    to: instantOf(params, "to", timeZone),
    updatedSince: instantOf(params, "updatedSince", timeZone, false),
    customerId: uuidOf(params, "customerId"),
    limit: limitOf(params),
    cursor: cursorOf(params),
  });
}

export type LeadListParams = {
  status?: LeadStatus[];
  source?: string;
  customerId?: string;
  createdSince?: string;
  updatedSince?: string;
  limit: number;
  cursor: Cursor | null;
};

export function parseLeadList(params: URLSearchParams, timeZone: string): Parsed<LeadListParams> {
  const source = one(params, "source");
  return all<LeadListParams>({
    status: listOf(params, "status", LEAD_STATUSES),
    source: source && source.length > 50 ? bad("source", "source is too long.") : ok(source),
    customerId: uuidOf(params, "customerId"),
    createdSince: instantOf(params, "createdSince", timeZone, false),
    updatedSince: instantOf(params, "updatedSince", timeZone, false),
    limit: limitOf(params),
    cursor: cursorOf(params),
  });
}

export type CustomerListParams = {
  email?: string;
  phone?: string;
  updatedSince?: string;
  limit: number;
  cursor: Cursor | null;
};

export function parseCustomerList(params: URLSearchParams, timeZone: string): Parsed<CustomerListParams> {
  const email = one(params, "email");
  const phone = one(params, "phone");
  const normalPhone = phone === undefined ? undefined : normalizePhone(phone);
  return all<CustomerListParams>({
    email: email === undefined ? ok(undefined) : z.email().safeParse(email).success ? ok(email.toLowerCase()) : bad("email", "email isn't a valid email address."),
    phone: phone === undefined ? ok(undefined) : normalPhone ? ok(normalPhone) : bad("phone", "phone isn't a valid phone number."),
    updatedSince: instantOf(params, "updatedSince", timeZone, false),
    limit: limitOf(params),
    cursor: cursorOf(params),
  });
}

// ------------------------------------------------------------------ jobs (quote and availability)

export type JobParams = {
  serviceId: string;
  sizeClass: SizeClass;
  locationType: "mobile" | "unit";
  addOnIds: string[];
  postcode?: string;
};

export function parseJob(params: URLSearchParams): Parsed<JobParams> {
  const serviceId = one(params, "serviceId");
  if (!serviceId) return bad("serviceId", "serviceId is required: a service id from /v1/catalog.");
  if (!z.uuid().safeParse(serviceId).success) return bad("serviceId", "serviceId must be a service id from /v1/catalog.");

  const sizeClass = one(params, "sizeClass");
  if (!sizeClass) return bad("sizeClass", `sizeClass is required: one of ${Object.keys(SIZE_CLASSES).join(", ")}.`);
  if (!(sizeClass in SIZE_CLASSES)) return bad("sizeClass", `sizeClass must be one of ${Object.keys(SIZE_CLASSES).join(", ")}.`);

  const locationType = one(params, "locationType");
  if (locationType !== "mobile" && locationType !== "unit") {
    return bad("locationType", "locationType is required: mobile (at the customer's address) or unit (dropped off).");
  }

  const addOnIds = (one(params, "addOnIds") ?? "").split(",").map((v) => v.trim()).filter(Boolean);
  if (addOnIds.length > 20) return bad("addOnIds", "Send up to 20 addOnIds.");
  if (addOnIds.some((id) => !z.uuid().safeParse(id).success)) return bad("addOnIds", "addOnIds must be add-on ids from /v1/catalog, separated by commas.");

  const postcode = postcodeOf(params);
  if (!postcode.ok) return postcode;

  return ok({ serviceId, sizeClass: sizeClass as SizeClass, locationType, addOnIds: [...new Set(addOnIds)], postcode: postcode.value });
}

export function postcodeOf(params: URLSearchParams, required = false): Parsed<string | undefined> {
  const raw = one(params, "postcode");
  if (raw === undefined) return required ? bad("postcode", "postcode is required, such as BS1 4DJ.") : ok(undefined);
  return isUkPostcode(raw) ? ok(normalizePostcode(raw)) : bad("postcode", "postcode must be a full UK postcode, such as BS1 4DJ.");
}

export function parseDate(params: URLSearchParams): Parsed<string> {
  const date = one(params, "date");
  if (!date) return bad("date", "date is required, such as 2026-11-20.");
  return isIsoDate(date) ? ok(date) : bad("date", "date must be a date such as 2026-11-20.");
}

// ------------------------------------------------------------------ bodies

const text = (max: number) => z.string().trim().max(max);

export const createLeadSchema = z
  .object({
    name: text(200).min(1, "name is required."),
    email: text(320).toLowerCase().pipe(z.email("email isn't a valid email address.")).optional(),
    phone: text(40)
      .refine((v) => normalizePhone(v) !== null, "phone isn't a valid phone number.")
      .transform((v) => normalizePhone(v)!)
      .optional(),
    postcode: text(10).optional(),
    message: text(5000).optional(),
    serviceId: z.uuid("serviceId must be a service id from /v1/catalog.").optional(),
    answers: z
      .array(z.object({ question: text(300).min(1), answer: text(5000) }), "answers must be a list of { question, answer }.")
      .max(30, "Send up to 30 answers.")
      .optional(),
    formName: text(100).optional(),
    externalId: text(200).min(1).optional(),
  })
  .refine((v) => v.email || v.phone, { message: "Send an email or a phone number, or both.", path: ["email"] });
export type CreateLeadInput = z.output<typeof createLeadSchema>;

export const createWebhookSchema = z.object({
  url: z.string().trim().min(1, "url is required.").max(2000),
  events: z.array(z.string(), "events must be a list of event names.").min(1, "Choose at least one event."),
  description: text(200).optional(),
});

// The first problem in a body, as the API reports it.
export function bodyProblem(error: z.ZodError) {
  const issue = error.issues[0];
  const param = issue?.path.map(String).join(".") || undefined;
  return { param, message: issue?.message ?? "The request body isn't valid." };
}
