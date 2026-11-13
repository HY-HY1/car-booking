// Booking API v1: every request and response shape.
//
// This file is the contract. The docs show it word for word (docs/api/types),
// and the server code that builds each response is typed against it, so the
// two can't drift. It has no imports: copy it into your own project as is.
//
// v1 never changes shape. Fields may be added; nothing is renamed, retyped or
// removed. Anything that would break that becomes /v2.

// ------------------------------------------------------------------ common

/** An ISO 8601 date and time in UTC, such as "2026-11-20T09:00:00.000Z". */
export type DateTime = string;
/** A calendar date, "YYYY-MM-DD", in the business's own time zone. */
export type DateOnly = string;

export type SizeClass = "small" | "medium" | "large" | "xl";
/** "mobile": at the customer's address. "unit": dropped off at the business. */
export type LocationType = "mobile" | "unit";

/** One page of a list. Pass nextCursor back as ?cursor= for the next page. */
export type List<T> = {
  data: T[];
  hasMore: boolean;
  nextCursor: string | null;
};

export type ApiError = {
  error: {
    code: ErrorCode;
    /** For people. May be reworded: branch on code, not message. */
    message: string;
    /** The query parameter or body field that was wrong, when there is one. */
    param?: string;
  };
};

export type ErrorCode =
  | "missing_key"
  | "invalid_key"
  | "insufficient_scope"
  | "invalid_request"
  | "not_found"
  | "not_set_up"
  | "limit_reached"
  | "rate_limited"
  | "server_error"
  // Quotes and availability
  | "unknown_service"
  | "unknown_add_on"
  | "add_on_not_for_service"
  | "location_not_offered"
  | "postcode_required"
  | "unknown_postcode"
  | "outside_area";

/** What a key may do. Chosen by the business owner when the key is made. */
export type Scope =
  | "catalog:read"
  | "bookings:read"
  | "customers:read"
  | "leads:read"
  | "leads:write"
  | "webhooks:write";

// ------------------------------------------------------------------ business

/** GET /v1/business */
export type Business = {
  name: string;
  tagline: string | null;
  /** The business's booking site. Null until its booking address is set up. */
  bookingUrl: string | null;
  websiteUrl: string | null;
  contact: { email: string | null; phone: string | null };
  branding: {
    logoUrl: string | null;
    coverUrl: string | null;
    /** "#rrggbb" */
    primaryColor: string;
    /** "#rrggbb" */
    accentColor: string;
  };
  locations: {
    /** Comes to the customer's home or work. */
    mobile: boolean;
    /** Takes cars at its own premises. Null if it doesn't. */
    unit: { address: string | null; postcode: string | null } | null;
  };
  /** Opening hours for each way of working. Null where it isn't offered. */
  openingHours: { mobile: OpeningHours | null; unit: OpeningHours | null };
  booking: {
    /** True when the business approves each booking before it's confirmed. */
    approvalRequired: boolean;
    /** How soon the earliest booking can be, in hours from now. */
    minNoticeHours: number;
    /** How far ahead customers can book, in days. */
    maxDaysAhead: number;
    deposit: Deposit;
  };
  links: { terms: string | null; privacy: string | null };
  /** IANA time zone the business works in, such as "Europe/London". */
  timezone: string;
  currency: "GBP";
};

/** Every day is present. A closed day is an empty list. Times are "HH:MM". */
export type OpeningHours = Record<
  "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday",
  { opens: string; closes: string }[]
>;

export type Deposit =
  | { type: "none" }
  | { type: "percent"; percent: number }
  | { type: "fixed"; amountPence: number }
  /** The whole price is paid when booking. */
  | { type: "full" };

// ------------------------------------------------------------------ catalogue

/** GET /v1/catalog */
export type Catalog = {
  version: 1;
  business: { name: string; bookingUrl: string | null };
  services: CatalogService[];
  addOns: CatalogAddOn[];
};

export type CatalogService = {
  id: string;
  slug: string | null;
  name: string;
  tagline: string | null;
  description: string | null;
  badge: string | null;
  durationMins: number;
  locations: LocationType[];
  price: {
    fromPence: number;
    /** Formatted, such as "£85". */
    from: string;
    /** Extra price and time for bigger vehicles. Sizes that cost nothing extra are left out. */
    bySize: { size: SizeClass; label: string; extraPence: number; extraMins: number }[];
  };
  image: string | null;
  gallery: string[];
  includes: string[];
  notIncluded: string[];
  steps: { title: string; text: string }[];
  faqs: { q: string; a: string }[];
  body: string | null;
  seo: { title: string | null; description: string | null };
  pageUrl: string | null;
  bookUrl: string | null;
};

export type CatalogAddOn = {
  id: string;
  name: string;
  description: string | null;
  pricePence: number;
  /** Formatted, such as "£15.50". */
  price: string;
  durationMins: number;
  /** The services it can go with. Null means all of them. */
  serviceIds: string[] | null;
};

// ------------------------------------------------------------------ quotes and availability

/**
 * Query parameters for GET /v1/quote, /v1/availability/dates and
 * /v1/availability/slots. addOnIds is comma-separated in the query string.
 */
export type JobQuery = {
  serviceId: string;
  sizeClass: SizeClass;
  locationType: LocationType;
  addOnIds?: string[];
  /** Where the car will be. Required for "mobile" availability; adds any travel fee to a quote. */
  postcode?: string;
};

/** GET /v1/quote */
export type Quote = {
  serviceId: string;
  serviceName: string;
  sizeClass: SizeClass;
  locationType: LocationType;
  addOnIds: string[];
  lines: QuoteLine[];
  totalPence: number;
  /** Formatted, such as "£140". */
  total: string;
  depositPence: number;
  deposit: string;
  durationMins: number;
  /**
   * True when the business checks the car before confirming the price. The
   * booking form asks for photos to settle it; a quote from the API can't.
   */
  needsInspection: boolean;
  /** Opens the booking form with this service chosen. */
  bookUrl: string | null;
};

export type QuoteLine = { label: string; amountPence: number };

/** GET /v1/availability/dates */
export type AvailableDates = {
  /** How long the job takes, which is what the dates were worked out for. */
  durationMins: number;
  timezone: string;
  /** Every date in the booking window with at least one free start time, in order. */
  dates: DateOnly[];
};

/** GET /v1/availability/slots */
export type AvailableSlots = {
  date: DateOnly;
  durationMins: number;
  timezone: string;
  slots: { startsAt: DateTime; /** "09:30", local time. */ time: string }[];
};

/** GET /v1/service-area */
export type ServiceAreaCheck = {
  /** Tidied: upper case with one space, such as "GL51 0QX". */
  postcode: string;
  /** Whether the business comes to that postcode. */
  covered: boolean;
  /** Why not, for people, when it isn't covered. */
  message: string | null;
};

// ------------------------------------------------------------------ bookings

export type BookingStatus = "requested" | "confirmed" | "completed" | "cancelled" | "no_show";

export type DepositStatus =
  | "none"
  | "pending"
  | "paid"
  | "refunded"
  | "partially_refunded"
  | "disputed"
  | "waived";

/** GET /v1/bookings, GET /v1/bookings/{id}, and booking webhooks. */
export type Booking = {
  id: string;
  /** Short reference the customer sees, such as "6D1F0C2A". */
  reference: string;
  status: BookingStatus;
  startsAt: DateTime;
  endsAt: DateTime;
  service: { id: string; name: string } | null;
  /** The price as the customer saw it, line by line. */
  lines: QuoteLine[];
  price: { totalPence: number; depositPence: number; depositStatus: DepositStatus };
  location: { type: LocationType; address: string | null; postcode: string };
  customer: CustomerSummary | null;
  vehicle: { make: string | null; model: string | null; registration: string | null; sizeClass: SizeClass } | null;
  /** What the customer wrote. Never the team's internal notes. */
  notes: string | null;
  vanOrBay: { id: string; name: string } | null;
  staff: { id: string; name: string } | null;
  /** "booking_page", "manual" (added by the business), or another source. */
  source: string;
  needsInspection: boolean;
  createdAt: DateTime;
  updatedAt: DateTime;
};

export type CustomerSummary = { id: string; name: string; email: string | null; phone: string | null };

/** Query parameters for GET /v1/bookings. */
export type BookingListQuery = {
  /** Comma-separated. Default: every status. */
  status?: string;
  /** Starts at or after this date or date-time. */
  from?: DateOnly | DateTime;
  /** Starts before this date or date-time. */
  to?: DateOnly | DateTime;
  /** Changed at or after this date-time. */
  updatedSince?: DateTime;
  customerId?: string;
  /** 1 to 100. Default 25. */
  limit?: number;
  cursor?: string;
};

// ------------------------------------------------------------------ leads

export type LeadStatus = "new" | "quoted" | "booked" | "lost";

/** GET /v1/leads, GET /v1/leads/{id}, POST /v1/leads, and the lead.created webhook. */
export type Lead = {
  id: string;
  status: LeadStatus;
  /** "booking_page", "website" (sent through the API), "facebook_lead_form", "instagram_lead_form"… */
  source: string;
  /** The service they asked about, if any. */
  service: { id: string | null; name: string } | null;
  /** The last price they were shown on the booking form, if they got that far. */
  quote: { totalPence: number; sizeClass: SizeClass | null; locationType: LocationType | null } | null;
  postcode: string | null;
  /** The form they filled in, for leads from the API or a lead form. */
  form: {
    name: string | null;
    answers: { question: string; answer: string }[];
  } | null;
  /** The id you sent when creating it through the API. */
  externalId: string | null;
  customer: CustomerSummary | null;
  createdAt: DateTime;
  updatedAt: DateTime;
};

/** Query parameters for GET /v1/leads. */
export type LeadListQuery = {
  /** Comma-separated. Default: every status. */
  status?: string;
  source?: string;
  customerId?: string;
  createdSince?: DateTime;
  updatedSince?: DateTime;
  limit?: number;
  cursor?: string;
};

/** Body of POST /v1/leads: an enquiry from a form on your own website. */
export type CreateLeadRequest = {
  name: string;
  /** At least one of email and phone. */
  email?: string;
  phone?: string;
  postcode?: string;
  /** What they wrote. Shown to the business as the first answer. */
  message?: string;
  /** A service from the catalogue, if they picked one. */
  serviceId?: string;
  /** Any other questions on your form. Up to 30. */
  answers?: { question: string; answer: string }[];
  /** Which form it came from, such as "Contact page". */
  formName?: string;
  /** Your own id for this enquiry. Sending the same one again returns the first lead instead of adding another. */
  externalId?: string;
};

// ------------------------------------------------------------------ customers

/** GET /v1/customers, GET /v1/customers/{id} */
export type Customer = {
  id: string;
  name: string;
  email: string | null;
  /** E.164, such as "+447700900123". */
  phone: string | null;
  address: { line: string | null; postcode: string | null };
  /** Where they first came from: "booking_page", "manual", "website", "facebook"… */
  source: string;
  /** What they've agreed to be sent. Only send marketing on a true. */
  marketing: { email: boolean; sms: boolean; whatsapp: boolean };
  vehicles: { id: string; make: string | null; model: string | null; registration: string | null; sizeClass: SizeClass }[];
  createdAt: DateTime;
  updatedAt: DateTime;
};

/** Query parameters for GET /v1/customers. */
export type CustomerListQuery = {
  /** Exact match, any case. */
  email?: string;
  /** Exact match. UK numbers can be in any common format. */
  phone?: string;
  updatedSince?: DateTime;
  limit?: number;
  cursor?: string;
};

// ------------------------------------------------------------------ webhooks

export type WebhookEventType =
  | "booking.created"
  | "booking.confirmed"
  | "booking.rescheduled"
  | "booking.cancelled"
  | "booking.completed"
  | "booking.no_show"
  | "booking.updated"
  | "lead.created";

/** GET /v1/webhooks, GET /v1/webhooks/{id} */
export type Webhook = {
  id: string;
  url: string;
  description: string | null;
  events: WebhookEventType[];
  /** False once paused after repeated failures, or switched off by the business. */
  active: boolean;
  createdAt: DateTime;
};

/** POST /v1/webhooks returns the signing secret, once. */
export type CreatedWebhook = Webhook & { secret: string };

/** Body of POST /v1/webhooks. */
export type CreateWebhookRequest = {
  /** https only. */
  url: string;
  events: WebhookEventType[];
  description?: string;
};

/** What a webhook POSTs to you. */
export type WebhookPayload =
  | WebhookEnvelope<Exclude<WebhookEventType, "lead.created">, { booking: Booking }>
  | WebhookEnvelope<"lead.created", { lead: Lead }>
  | WebhookEnvelope<"ping", { message: string }>;

export type WebhookEnvelope<Type extends string, Data> = {
  /** The same on every retry: use it to ignore one you've already had. */
  id: string;
  type: Type;
  createdAt: DateTime;
  data: Data;
};
