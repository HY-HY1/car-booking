import { formatPence } from "../booking/config";
import { bookingReference } from "../booking/confirmation";
import type { Quote as EngineQuote } from "../booking/pricing";
import type { Booking, BookingStatus, Customer, CustomerSummary, DepositStatus, Lead, LeadStatus, LocationType, Quote, SizeClass } from "./types";

// Database rows → the API's public shapes (types.ts). The API and webhooks
// both use these, so a booking looks the same however it reaches you. Pure:
// the queries live in data.ts and webhooks/deliver.ts, with these columns.

const SIZES = new Set(["small", "medium", "large", "xl"]);
const sizeOrNull = (value: unknown): SizeClass | null => (typeof value === "string" && SIZES.has(value) ? (value as SizeClass) : null);
const locationOrNull = (value: unknown): LocationType | null => (value === "mobile" || value === "unit" ? value : null);

// ------------------------------------------------------------------ bookings

export const BOOKING_COLUMNS =
  "id, status, starts_at, ends_at, created_at, updated_at, location_type, address_line, postcode, customer_notes, price_pence, deposit_pence, deposit_status, source, quote_snapshot, service:services(id, name), customer:customers(id, name, email, phone), vehicle:vehicles(make, model, registration, size_class), resource:resources(id, name), staff:staff(id, name)";

// Statuses the API shows. A held booking is someone part-way through paying,
// and an expired one is a checkout they left: neither is a booking yet.
export const VISIBLE_BOOKING_STATUSES: BookingStatus[] = ["requested", "confirmed", "completed", "cancelled", "no_show"];

export type BookingRow = {
  id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  created_at: string;
  updated_at: string;
  location_type: string;
  address_line: string | null;
  postcode: string;
  customer_notes: string | null;
  price_pence: number;
  deposit_pence: number;
  deposit_status: string;
  source: string;
  quote_snapshot: { lines?: { label: string; amount_pence: number }[]; needs_inspection?: boolean } | null;
  service: { id: string; name: string } | null;
  customer: { id: string; name: string; email: string | null; phone: string | null } | null;
  vehicle: { make: string | null; model: string | null; registration: string | null; size_class: string } | null;
  resource: { id: string; name: string } | null;
  staff: { id: string; name: string } | null;
};

const iso = (value: string) => new Date(value).toISOString();

export function bookingResource(b: BookingRow): Booking {
  return {
    id: b.id,
    reference: bookingReference(b.id),
    status: b.status as BookingStatus,
    startsAt: iso(b.starts_at),
    endsAt: iso(b.ends_at),
    service: b.service,
    lines: (b.quote_snapshot?.lines ?? []).map((l) => ({ label: l.label, amountPence: l.amount_pence })),
    price: { totalPence: b.price_pence, depositPence: b.deposit_pence, depositStatus: b.deposit_status as DepositStatus },
    location: { type: b.location_type as LocationType, address: b.address_line, postcode: b.postcode },
    customer: b.customer,
    vehicle: b.vehicle
      ? { make: b.vehicle.make, model: b.vehicle.model, registration: b.vehicle.registration, sizeClass: b.vehicle.size_class as SizeClass }
      : null,
    notes: b.customer_notes,
    vanOrBay: b.resource,
    staff: b.staff,
    source: b.source,
    needsInspection: b.quote_snapshot?.needs_inspection === true,
    createdAt: iso(b.created_at),
    updatedAt: iso(b.updated_at),
  };
}

// ------------------------------------------------------------------ leads

export const LEAD_COLUMNS =
  "id, status, source, external_id, created_at, updated_at, quote_snapshot, form_answers, customer:customers(id, name, email, phone)";

export type LeadRow = {
  id: string;
  status: string;
  source: string;
  external_id: string | null;
  created_at: string;
  updated_at: string;
  quote_snapshot: Record<string, unknown> | null;
  form_answers: { form?: string | null; answers?: { question: string; answer: string }[] } | null;
  customer: CustomerSummary | null;
};

// Leads added through the API keep the caller's id as "api:<id>".
export const API_EXTERNAL_PREFIX = "api:";

export function leadResource(l: LeadRow): Lead {
  const q = l.quote_snapshot ?? {};
  const serviceName = typeof q.service_name === "string" ? q.service_name : null;
  const serviceId = typeof q.service_id === "string" ? q.service_id : null;
  return {
    id: l.id,
    status: l.status as LeadStatus,
    source: l.source,
    service: serviceName ? { id: serviceId, name: serviceName } : null,
    quote:
      typeof q.total_pence === "number"
        ? { totalPence: q.total_pence, sizeClass: sizeOrNull(q.size_class), locationType: locationOrNull(q.location_type) }
        : null,
    postcode: typeof q.postcode === "string" ? q.postcode : null,
    form: l.form_answers
      ? {
          name: l.form_answers.form ?? null,
          answers: (l.form_answers.answers ?? []).map((a) => ({ question: a.question, answer: a.answer })),
        }
      : null,
    externalId: l.external_id?.startsWith(API_EXTERNAL_PREFIX) ? l.external_id.slice(API_EXTERNAL_PREFIX.length) : null,
    customer: l.customer,
    createdAt: iso(l.created_at),
    updatedAt: iso(l.updated_at),
  };
}

// ------------------------------------------------------------------ customers

export const CUSTOMER_COLUMNS =
  "id, name, email, phone, address_line, postcode, source, email_marketing, sms_marketing, whatsapp_marketing, created_at, updated_at, vehicles(id, make, model, registration, size_class, created_at)";

export type CustomerRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address_line: string | null;
  postcode: string | null;
  source: string;
  email_marketing: boolean;
  sms_marketing: boolean;
  whatsapp_marketing: boolean;
  created_at: string;
  updated_at: string;
  vehicles: { id: string; make: string | null; model: string | null; registration: string | null; size_class: string; created_at: string }[] | null;
};

export function customerResource(c: CustomerRow): Customer {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    address: { line: c.address_line, postcode: c.postcode },
    source: c.source,
    marketing: { email: c.email_marketing, sms: c.sms_marketing, whatsapp: c.whatsapp_marketing },
    vehicles: [...(c.vehicles ?? [])]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((v) => ({ id: v.id, make: v.make, model: v.model, registration: v.registration, sizeClass: v.size_class as SizeClass })),
    createdAt: iso(c.created_at),
    updatedAt: iso(c.updated_at),
  };
}

// ------------------------------------------------------------------ quotes

export function quoteResource(q: EngineQuote, bookUrl: string | null): Quote {
  return {
    serviceId: q.service_id,
    serviceName: q.service_name,
    sizeClass: q.size_class,
    locationType: q.location_type,
    addOnIds: q.add_on_ids,
    lines: q.lines.map((l) => ({ label: l.label, amountPence: l.amount_pence })),
    totalPence: q.total_pence,
    total: formatPence(q.total_pence),
    depositPence: q.deposit_pence,
    deposit: formatPence(q.deposit_pence),
    durationMins: q.duration_mins,
    needsInspection: q.needs_inspection,
    bookUrl,
  };
}
