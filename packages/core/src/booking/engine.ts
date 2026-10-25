import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { normalizePhone, normalizePostcode } from "../customer-fields";
import { notifyBookingSecured } from "../email/notify";
import { attachPhotos, MAX_PHOTOS } from "../photos";
import { createAdminClient } from "../supabase/admin";
import { getTenantPayments } from "../stripe/accounts";
import { depositDescription } from "../stripe/checkout";
import { collectsDepositOnline, holdMinutesFor } from "../stripe/rules";
import { loadAssessment } from "./assess";
import { dayRange, type BusyPeriod } from "./availability";
import { bookableDatesFor, openSlots } from "./capacity";
import {
  addOnSchema,
  bookingSettingsSchema,
  bufferFor,
  formatPence,
  locationTypeSchema,
  resourceSchema,
  resourcesFor,
  serviceSchema,
  sizeClassSchema,
  type AddOn,
  type BookingSettings,
  type LocationType,
  type Resource,
  type Service,
} from "./config";
import {
  checkServiceArea,
  coordsFor,
  estimateDriveMins,
  haversineMiles,
  isUkPostcode,
  lookupPostcodes,
} from "./geo";
import { conditionCheck } from "./condition";
import { getQuote, QuoteError, type Quote } from "./pricing";
import { isIsoDate, localDate, localTime } from "./time";
import { detailsSchema } from "./answers";

// The booking engine: the tool layer the booking form uses today and the
// Booking Agent will call tomorrow. Every function takes the tenant id from
// the caller's server context (hostname or session), parses the rest of its
// input as untrusted, applies the tenant's rules and returns a small result.
// Errors customers can act on come back as { ok: false, message }.

export type EngineResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; code: string; message: string };

function fail(code: string, message: string) {
  return { ok: false as const, code, message };
}

function invalid(error: z.ZodError) {
  return fail("invalid_input", error.issues[0]?.message ?? "Check your answers and try again.");
}

export type BookingConfig = {
  // offers_mobile / offers_unit here mean "can actually be booked": switched
  // on, and with at least one active van or bay to do it.
  settings: BookingSettings;
  services: Service[];
  addOns: AddOn[];
  // Active vans and bays, in the order they're filled.
  resources: Resource[];
};

// list_services: everything a customer can pick from. Null until the tenant
// has booking settings.
export async function getBookingConfig(tenantId: string): Promise<BookingConfig | null> {
  const db = createAdminClient();
  const [settings, services, addOns, resources] = await Promise.all([
    db.from("booking_settings").select("*").eq("tenant_id", tenantId).maybeSingle(),
    db
      .from("services")
      .select("id, name, description, tagline, includes, image_path, slug, badge, body, not_included, gallery, steps, faqs, seo_title, seo_description, duration_mins, base_price_pence, size_adjustments, location_types")
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .order("sort_order")
      .order("name"),
    db
      .from("add_ons")
      .select("id, name, description, price_pence, duration_mins, service_ids")
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .order("sort_order")
      .order("name"),
    db
      .from("resources")
      .select("id, name, location_types, weekly_hours, sort_order")
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .order("sort_order")
      .order("created_at"),
  ]);
  if (settings.error) throw settings.error;
  if (services.error) throw services.error;
  if (addOns.error) throw addOns.error;
  if (resources.error) throw resources.error;
  if (!settings.data) return null;

  const parsed = bookingSettingsSchema.parse(settings.data);
  const active = z.array(resourceSchema).parse(resources.data);
  return {
    settings: {
      ...parsed,
      offers_mobile: parsed.offers_mobile && resourcesFor(active, "mobile").length > 0,
      offers_unit: parsed.offers_unit && resourcesFor(active, "unit").length > 0,
    },
    services: z.array(serviceSchema).parse(services.data),
    addOns: z.array(addOnSchema).parse(addOns.data),
    resources: active,
  };
}

async function requireConfig(tenantId: string) {
  const config = await getBookingConfig(tenantId);
  if (!config) throw new Error(`Tenant ${tenantId} has no booking settings`);
  return config;
}

// ---------------------------------------------------------------- inputs

const postcodeSchema = z
  .string()
  .trim()
  .refine(isUkPostcode, "Enter a full UK postcode, like BS1 4DJ.")
  .transform(normalizePostcode);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || undefined);

export const quoteRequestSchema = z.object({
  serviceId: z.uuid(),
  sizeClass: sizeClassSchema,
  // The photo check (assess.ts) that decides the condition level, if any.
  assessmentId: z.uuid().nullish(),
  addOnIds: z.array(z.uuid()).max(20).default([]),
  locationType: locationTypeSchema,
});
export type QuoteRequest = z.input<typeof quoteRequestSchema>;

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(200),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  phone: z
    .string()
    .trim()
    .refine((v) => normalizePhone(v) !== null, "Enter a valid phone number.")
    .transform((v) => normalizePhone(v)!),
  emailMarketing: z.boolean().default(false),
});

const accessSchema = z.object({
  water: z.enum(["yes", "no", "unsure"]).optional(),
  power: z.enum(["yes", "no", "unsure"]).optional(),
  parking: z.enum(["driveway", "street", "car_park", "other"]).optional(),
  carLocation: optionalText(300),
});

const registrationSchema = optionalText(10).transform((v) => v?.replace(/\s/g, "").toUpperCase() || undefined);

export const leadRequestSchema = quoteRequestSchema.extend({
  contact: contactSchema,
  postcode: postcodeSchema.optional(),
  addressLine: optionalText(300),
  source: z.string().max(50).default("booking_page"),
  // Photos uploaded earlier in the flow (see photos.ts), to attach.
  photoIds: z.array(z.uuid()).max(MAX_PHOTOS).default([]),
  // What they've told us so far, kept on the lead so the owner sees it even
  // if they never finish booking.
  draft: z
    .object({
      vehicle: z.object({ make: optionalText(60), model: optionalText(60), registration: registrationSchema }).optional(),
      access: accessSchema.optional(),
      details: detailsSchema.optional(),
    })
    .optional(),
});
export type LeadRequest = z.input<typeof leadRequestSchema>;

export const slotRequestSchema = quoteRequestSchema.extend({
  postcode: postcodeSchema.optional(),
  date: z.string().refine(isIsoDate, "Pick a date."),
});
export type SlotRequest = z.input<typeof slotRequestSchema>;

export const openDatesRequestSchema = quoteRequestSchema.extend({
  postcode: postcodeSchema.optional(),
});
export type OpenDatesRequest = z.input<typeof openDatesRequestSchema>;

export const holdRequestSchema = leadRequestSchema.extend({
  startsAt: z.iso.datetime({ offset: true }),
  // Make and model are required so the owner knows what they're detailing.
  // Not limited to vehicles/catalog.ts: "Other" lets customers type theirs.
  vehicle: z.object({
    make: z.string().trim().min(1, "Choose the car's make.").max(60),
    model: z.string().trim().min(1, "Choose the car's model.").max(60),
    registration: registrationSchema,
  }),
  access: accessSchema.prefault({}),
  details: detailsSchema.prefault({}),
  notes: optionalText(1000),
  // The total the customer was shown. If prices changed while they were
  // booking, they see the new total before anything is held.
  expectedTotalPence: z.number().int().optional(),
});
export type HoldRequest = z.input<typeof holdRequestSchema>;

// ---------------------------------------------------------------- get_quote

// The condition level comes from the photo check the booking form sent back
// (assess.ts), read from the stored row so the browser can't choose it.
async function quoteFor(tenantId: string, config: BookingConfig, req: z.output<typeof quoteRequestSchema>) {
  const service = config.services.find((s) => s.id === req.serviceId);
  if (!service) return fail("unknown_service", "That service isn't available.");
  const assessment = req.assessmentId ? await loadAssessment(tenantId, req.assessmentId) : null;
  const condition = conditionCheck(config.settings.condition_tiers, assessment);
  try {
    const quote = getQuote({
      service,
      addOns: config.addOns,
      addOnIds: req.addOnIds,
      sizeClass: req.sizeClass,
      conditionKey: condition?.key ?? null,
      locationType: req.locationType,
      settings: config.settings,
    });
    return { ok: true as const, quote, condition };
  } catch (error) {
    if (error instanceof QuoteError) return fail(error.code, error.message);
    throw error;
  }
}

export async function quote(tenantId: string, input: unknown): Promise<EngineResult<{ quote: Quote }>> {
  const parsed = quoteRequestSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return quoteFor(tenantId, await requireConfig(tenantId), parsed.data);
}

// ---------------------------------------------------------------- check_service_area

async function areaCheck(settings: BookingSettings, postcode: string) {
  const lookup = await lookupPostcodes([postcode, settings.base_postcode ?? postcode]);
  const job = coordsFor(lookup, postcode);
  // null = postcodes.io says the postcode doesn't exist.
  if (lookup.get(postcode.replace(/\s/g, "")) === null) {
    return fail("unknown_postcode", "We couldn't find that postcode. Check it and try again.");
  }
  const result = checkServiceArea(postcode, settings.service_area, {
    job,
    base: coordsFor(lookup, settings.base_postcode),
  });
  if (result.ok) return { ok: true as const, miles: result.miles };
  // Lookup service unreachable: let the booking through rather than lose
  // it; the owner sees the postcode on the booking.
  if (result.reason === "unknown_postcode") return { ok: true as const, miles: undefined };
  return fail(
    "outside_area",
    "Sorry, that's outside the area we cover. Get in touch and we'll see what we can do.",
  );
}

export async function checkArea(
  tenantId: string,
  input: unknown,
): Promise<EngineResult<{ miles?: number }>> {
  const parsed = postcodeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { settings } = await requireConfig(tenantId);
  return areaCheck(settings, parsed.data);
}

// ---------------------------------------------------------------- check_availability

function jobPostcode(settings: BookingSettings, req: { locationType: string; postcode?: string }) {
  return req.locationType === "unit" ? settings.unit_postcode : (req.postcode ?? null);
}

// Each van's and bay's jobs and blocked time overlapping a stretch of time,
// as busy periods. Travel is measured from each job to `postcode`; the gap
// kept depends on whether both jobs are at the shop. Time off for the whole
// business goes in every resource's list, time off for one only in its own.
async function loadBusyByResource(
  db: SupabaseClient,
  tenantId: string,
  settings: BookingSettings,
  resources: Resource[],
  from: Date,
  to: Date,
  postcode: string,
  locationType: LocationType,
): Promise<Map<string, BusyPeriod[]>> {
  const [bookings, blocked] = await Promise.all([
    db
      .from("bookings")
      .select("starts_at, ends_at, postcode, status, hold_expires_at, resource_id, location_type")
      .eq("tenant_id", tenantId)
      .in("status", ["held", "requested", "confirmed"])
      .lt("starts_at", to.toISOString())
      .gt("ends_at", from.toISOString()),
    db
      .from("blocked_times")
      .select("starts_at, ends_at, resource_id")
      .eq("tenant_id", tenantId)
      .lt("starts_at", to.toISOString())
      .gt("ends_at", from.toISOString()),
  ]);
  if (bookings.error) throw bookings.error;
  if (blocked.error) throw blocked.error;

  const now = Date.now();
  // A hold only counts until it lapses; requested and confirmed jobs always do.
  const live = bookings.data.filter(
    (b) => b.status !== "held" || new Date(b.hold_expires_at).getTime() > now,
  );

  const lookup = await lookupPostcodes([postcode, ...live.map((b) => b.postcode)]);
  const here = coordsFor(lookup, postcode);

  const busy = new Map<string, BusyPeriod[]>(resources.map((r) => [r.id, []]));
  for (const b of live) {
    const there = coordsFor(lookup, b.postcode);
    busy.get(b.resource_id)?.push({
      kind: "job",
      start: new Date(b.starts_at),
      end: new Date(b.ends_at),
      travelMins: here && there ? estimateDriveMins(haversineMiles(here, there)) : undefined,
      bufferMins: bufferFor(settings, b.location_type, locationType),
    });
  }
  for (const b of blocked.data) {
    const period: BusyPeriod = { kind: "blocked", start: new Date(b.starts_at), end: new Date(b.ends_at) };
    if (b.resource_id) busy.get(b.resource_id)?.push(period);
    else for (const list of busy.values()) list.push(period);
  }
  return busy;
}

async function loadBusyForDay(
  db: SupabaseClient,
  tenantId: string,
  settings: BookingSettings,
  resources: Resource[],
  date: string,
  postcode: string,
  locationType: LocationType,
) {
  const { from, to } = dayRange(date, settings.timezone);
  return loadBusyByResource(db, tenantId, settings, resources, from, to, postcode, locationType);
}

export type Slot = { startsAt: string; time: string };

export async function findSlots(
  tenantId: string,
  input: unknown,
): Promise<EngineResult<{ date: string; slots: Slot[] }>> {
  const parsed = slotRequestSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const req = parsed.data;

  const config = await requireConfig(tenantId);
  const quoted = await quoteFor(tenantId, config, req);
  if (!quoted.ok) return quoted;

  const postcode = jobPostcode(config.settings, req);
  if (!postcode) return fail("postcode_required", "Enter the postcode where the car will be.");

  const busyByResource = await loadBusyForDay(
    createAdminClient(),
    tenantId,
    config.settings,
    config.resources,
    req.date,
    postcode,
    req.locationType,
  );
  const offers = openSlots({
    date: req.date,
    durationMins: quoted.quote.duration_mins,
    locationType: req.locationType,
    settings: config.settings,
    resources: config.resources,
    busyByResource,
    now: new Date(),
  });

  return {
    ok: true,
    date: req.date,
    slots: offers.map((o) => ({
      startsAt: o.start.toISOString(),
      time: localTime(o.start, config.settings.timezone),
    })),
  };
}

// check_availability across the whole booking window: which days have at
// least one start time free for this job. Lets the calendar grey out days
// that are closed or fully booked, instead of the customer finding out by
// picking them one at a time.
export async function findOpenDates(
  tenantId: string,
  input: unknown,
): Promise<EngineResult<{ dates: string[] }>> {
  const parsed = openDatesRequestSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const req = parsed.data;

  const config = await requireConfig(tenantId);
  const quoted = await quoteFor(tenantId, config, req);
  if (!quoted.ok) return quoted;

  const postcode = jobPostcode(config.settings, req);
  if (!postcode) return fail("postcode_required", "Enter the postcode where the car will be.");

  const now = new Date();
  const candidates = bookableDatesFor(config.settings, config.resources, req.locationType, now);
  if (candidates.length === 0) return { ok: true, dates: [] };

  // One read for the whole window, then each day is checked against it.
  const from = dayRange(candidates[0], config.settings.timezone).from;
  const to = dayRange(candidates[candidates.length - 1], config.settings.timezone).to;
  const busyByResource = await loadBusyByResource(
    createAdminClient(),
    tenantId,
    config.settings,
    config.resources,
    from,
    to,
    postcode,
    req.locationType,
  );

  const dates = candidates.filter(
    (date) =>
      openSlots({
        date,
        durationMins: quoted.quote.duration_mins,
        locationType: req.locationType,
        settings: config.settings,
        resources: config.resources,
        busyByResource,
        now,
      }).length > 0,
  );
  return { ok: true, dates };
}

// ---------------------------------------------------------------- customers and leads

type Contact = z.output<typeof contactSchema>;

async function upsertCustomer(
  db: SupabaseClient,
  tenantId: string,
  contact: Contact,
  place: { postcode?: string; addressLine?: string },
  retry = true,
): Promise<string> {
  const columns = "id, email, phone, address_line, postcode, email_marketing";
  const byEmail = await db
    .from("customers")
    .select(columns)
    .eq("tenant_id", tenantId)
    .eq("email", contact.email)
    .maybeSingle();
  if (byEmail.error) throw byEmail.error;
  let existing = byEmail.data;
  if (!existing) {
    const byPhone = await db
      .from("customers")
      .select(columns)
      .eq("tenant_id", tenantId)
      .eq("phone", contact.phone)
      .maybeSingle();
    if (byPhone.error) throw byPhone.error;
    existing = byPhone.data;
  }

  if (existing) {
    // Fill gaps only; never overwrite what the owner has recorded, and
    // never withdraw consent from here (that's an explicit opt-out).
    const patch: Record<string, unknown> = {};
    if (!existing.email) patch.email = contact.email;
    if (!existing.phone) patch.phone = contact.phone;
    if (!existing.address_line && place.addressLine) patch.address_line = place.addressLine;
    if (!existing.postcode && place.postcode) patch.postcode = place.postcode;
    if (contact.emailMarketing && !existing.email_marketing) {
      Object.assign(patch, {
        email_marketing: true,
        marketing_basis: "consent",
        marketing_updated_at: new Date().toISOString(),
      });
    }
    if (Object.keys(patch).length) {
      const { error } = await db.from("customers").update(patch).eq("tenant_id", tenantId).eq("id", existing.id);
      // 23505: the email or phone belongs to another customer; keep both.
      if (error && error.code !== "23505") throw error;
    }
    return existing.id;
  }

  const { data, error } = await db
    .from("customers")
    .insert({
      tenant_id: tenantId,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      address_line: place.addressLine ?? null,
      postcode: place.postcode ?? null,
      source: "booking_page",
      email_marketing: contact.emailMarketing,
      marketing_basis: contact.emailMarketing ? "consent" : null,
      marketing_updated_at: contact.emailMarketing ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  // Created by a parallel request between our lookup and insert.
  if (error?.code === "23505" && retry) return upsertCustomer(db, tenantId, contact, place, false);
  if (error) throw error;
  return data.id;
}

// One open lead per customer: a second enquiry updates it rather than
// starting another follow-up sequence.
async function upsertLead(
  db: SupabaseClient,
  tenantId: string,
  customerId: string,
  source: string,
  snapshot: object | null,
): Promise<string> {
  const open = await db
    .from("leads")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("customer_id", customerId)
    .in("status", ["new", "quoted"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (open.error) throw open.error;

  const status = snapshot ? "quoted" : "new";
  if (open.data) {
    const { error } = await db
      .from("leads")
      .update({ status, ...(snapshot && { quote_snapshot: snapshot }) })
      .eq("tenant_id", tenantId)
      .eq("id", open.data.id);
    if (error) throw error;
    return open.data.id;
  }

  const { data, error } = await db
    .from("leads")
    .insert({ tenant_id: tenantId, customer_id: customerId, status, source, quote_snapshot: snapshot })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

// save_lead: called as soon as a customer has given contact details, so
// anyone who leaves before booking can be followed up.
export async function saveLead(tenantId: string, input: unknown): Promise<EngineResult<{ leadId: string }>> {
  const parsed = leadRequestSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const req = parsed.data;

  const config = await requireConfig(tenantId);
  const quoted = await quoteFor(tenantId, config, req);
  const db = createAdminClient();
  const customerId = await upsertCustomer(db, tenantId, req.contact, req);
  const leadId = await upsertLead(
    db,
    tenantId,
    customerId,
    req.source,
    quoted.ok
      ? { ...quoted.quote, condition: quoted.condition, postcode: req.postcode ?? null, answers: req.draft ?? {} }
      : null,
  );
  await attachPhotos(db, tenantId, req.photoIds, { customerId, leadId });
  return { ok: true, leadId };
}

// ---------------------------------------------------------------- hold_slot and confirm

async function expireStaleHolds(db: SupabaseClient, tenantId: string) {
  const { error } = await db
    .from("bookings")
    .update({ status: "expired" })
    .eq("tenant_id", tenantId)
    .eq("status", "held")
    .lt("hold_expires_at", new Date().toISOString());
  if (error) throw error;
}

// What the caller needs to start a Stripe Checkout for the deposit. Null when
// the booking has no online deposit (none due, or Stripe isn't connected).
export type DepositCheckout = {
  stripeAccountId: string;
  depositPence: number;
  description: string;
  customerEmail: string;
  leadId: string;
};

// hold_slot: re-checks the price and the slot server-side, records the
// customer, vehicle and lead, and holds the time while the deposit is paid.
export async function holdSlot(
  tenantId: string,
  input: unknown,
): Promise<
  EngineResult<{
    bookingId: string;
    holdExpiresAt: string;
    quote: Quote;
    depositCheckout: DepositCheckout | null;
  }>
> {
  const parsed = holdRequestSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const req = parsed.data;

  const config = await requireConfig(tenantId);
  const { settings } = config;
  const quoted = await quoteFor(tenantId, config, req);
  if (!quoted.ok) return quoted;
  const { quote } = quoted;
  if (req.expectedTotalPence !== undefined && req.expectedTotalPence !== quote.total_pence) {
    return fail(
      "price_changed",
      `The price has just been updated to ${formatPence(quote.total_pence)}. Check the new total and confirm again.`,
    );
  }

  const postcode = jobPostcode(settings, req);
  if (!postcode) return fail("postcode_required", "Enter the postcode where the car will be.");
  if (req.locationType === "mobile") {
    const area = await areaCheck(settings, postcode);
    if (!area.ok) return area;
  }
  if (!req.details.acceptedTerms) return fail("terms_required", "Please tick the box to confirm your details are right.");
  if (settings.photos_required && req.photoIds.length < settings.min_photos) {
    return fail(
      "photos_required",
      settings.min_photos === 1
        ? "Please add a photo of the car before booking."
        : `Please add at least ${settings.min_photos} photos of the car before booking.`,
    );
  }

  const db = createAdminClient();
  await expireStaleHolds(db, tenantId);

  const startsAt = new Date(req.startsAt);
  const date = localDate(startsAt, settings.timezone);
  const busyByResource = await loadBusyForDay(
    db,
    tenantId,
    settings,
    config.resources,
    date,
    postcode,
    req.locationType,
  );
  // Which vans or bays are free at this start; the first takes the job.
  const offer = openSlots({
    date,
    durationMins: quote.duration_mins,
    locationType: req.locationType,
    settings,
    resources: config.resources,
    busyByResource,
    now: new Date(),
  }).find((o) => o.start.getTime() === startsAt.getTime());
  if (!offer) return fail("slot_taken", "Sorry, that time has just gone. Pick another.");

  const customerId = await upsertCustomer(db, tenantId, req.contact, req);
  const { acceptedTerms: _accepted, ...details } = req.details;
  const snapshot = {
    ...quote,
    // How the condition level was settled (condition.ts), for the owner.
    condition: quoted.condition,
    postcode,
    // Everything the customer filled in, beside the price they were shown.
    answers: {
      vehicle: req.vehicle,
      access: req.access,
      notes: req.notes,
      details,
      termsAcceptedAt: new Date().toISOString(),
    },
  };
  const leadId = await upsertLead(db, tenantId, customerId, req.source, snapshot);

  const vehicle = await db
    .from("vehicles")
    .insert({
      tenant_id: tenantId,
      customer_id: customerId,
      size_class: quote.size_class,
      make: req.vehicle.make,
      model: req.vehicle.model,
      registration: req.vehicle.registration ?? null,
    })
    .select("id")
    .single();
  if (vehicle.error) throw vehicle.error;

  // With an online deposit the hold has to outlast the Checkout Session.
  const payments = await getTenantPayments(tenantId);
  const stripeAccountId =
    payments.accountId && collectsDepositOnline(quote.deposit_pence, payments.ready) ? payments.accountId : null;
  const holdMinutes = holdMinutesFor(settings.hold_minutes, stripeAccountId !== null);
  const holdExpiresAt = new Date(Date.now() + holdMinutes * 60_000).toISOString();
  const row = {
    tenant_id: tenantId,
    customer_id: customerId,
    vehicle_id: vehicle.data.id,
    service_id: quote.service_id,
    lead_id: leadId,
    starts_at: startsAt.toISOString(),
    ends_at: new Date(startsAt.getTime() + quote.duration_mins * 60_000).toISOString(),
    status: "held",
    hold_expires_at: holdExpiresAt,
    location_type: quote.location_type,
    address_line: req.locationType === "mobile" ? (req.addressLine ?? null) : settings.unit_address,
    postcode,
    access_notes: req.access,
    customer_notes: req.notes ?? null,
    quote_snapshot: snapshot,
    price_pence: quote.total_pence,
    deposit_pence: quote.deposit_pence,
    deposit_status: quote.deposit_pence > 0 ? "pending" : "none",
    source: req.source,
  };
  // 23P01: bookings_resource_no_overlap. Someone else took that van or bay in
  // the moment between our check and the insert; try the next free one.
  let data: { id: string } | null = null;
  for (const resourceId of offer.resourceIds) {
    const inserted = await db
      .from("bookings")
      .insert({ ...row, resource_id: resourceId })
      .select("id")
      .single();
    if (inserted.error?.code === "23P01") continue;
    if (inserted.error) throw inserted.error;
    data = inserted.data;
    break;
  }
  if (!data) return fail("slot_taken", "Sorry, that time has just gone. Pick another.");

  await attachPhotos(db, tenantId, req.photoIds, { customerId, leadId, bookingId: data.id });
  return {
    ok: true,
    bookingId: data.id,
    holdExpiresAt,
    quote,
    depositCheckout: stripeAccountId
      ? {
          stripeAccountId,
          depositPence: quote.deposit_pence,
          description: depositDescription(quote.service_name, startsAt, settings.timezone),
          customerEmail: req.contact.email,
          leadId,
        }
      : null,
  };
}

// What a hold becomes once it's secured: confirmed, or 'requested' when the
// business approves each booking itself (Settings → Booking).
export async function securedStatus(db: SupabaseClient, tenantId: string): Promise<"confirmed" | "requested"> {
  const { data, error } = await db.from("booking_settings").select("approval_mode").eq("tenant_id", tenantId).maybeSingle();
  if (error) throw error;
  return data?.approval_mode === "manual" ? "requested" : "confirmed";
}

// Turns a hold into a booking straight after the hold, when there's no online
// deposit to wait for. Paid deposits are confirmed by the Stripe webhook
// (stripe/payments.ts), which also copes with holds that lapsed mid-payment.
// The lead only counts as booked once the booking is confirmed.
export async function confirmBooking(
  tenantId: string,
  bookingId: string,
): Promise<EngineResult<{ bookingId: string; status: "confirmed" | "requested" }>> {
  const db = createAdminClient();
  const status = await securedStatus(db, tenantId);
  const { data, error } = await db
    .from("bookings")
    .update({
      status,
      hold_expires_at: null,
    })
    .eq("tenant_id", tenantId)
    .eq("id", bookingId)
    .eq("status", "held")
    .gt("hold_expires_at", new Date().toISOString())
    .select("id, lead_id")
    .maybeSingle();
  if (error) throw error;
  if (!data) return fail("hold_expired", "Your held time ran out. Pick a time again.");

  if (data.lead_id && status === "confirmed") {
    const lead = await db.from("leads").update({ status: "booked" }).eq("tenant_id", tenantId).eq("id", data.lead_id);
    if (lead.error) throw lead.error;
  }
  await notifyBookingSecured(tenantId, data.id);
  return { ok: true, bookingId: data.id, status };
}

// ---------------------------------------------------------------- booking status

export type BookingSummary = {
  status: "held" | "requested" | "confirmed" | "expired" | "other";
  serviceName: string | null;
  startsAt: string;
  timezone: string;
  depositPence: number;
  depositStatus: string;
};

// What the page after Stripe's checkout shows. The booking id is an
// unguessable uuid and is only matched within the tenant for this hostname.
export async function getBookingSummary(tenantId: string, bookingId: string): Promise<BookingSummary | null> {
  if (!z.uuid().safeParse(bookingId).success) return null;
  const db = createAdminClient();
  const [booking, settings] = await Promise.all([
    db
      .from("bookings")
      .select("status, starts_at, deposit_pence, deposit_status, hold_expires_at, service:services(name)")
      .eq("tenant_id", tenantId)
      .eq("id", bookingId)
      .maybeSingle(),
    db.from("booking_settings").select("timezone").eq("tenant_id", tenantId).maybeSingle(),
  ]);
  if (booking.error) throw booking.error;
  if (settings.error) throw settings.error;
  if (!booking.data) return null;

  const b = booking.data;
  const lapsed = b.status === "held" && new Date(b.hold_expires_at).getTime() <= Date.now();
  const status =
    lapsed || b.status === "expired"
      ? "expired"
      : b.status === "held" || b.status === "requested" || b.status === "confirmed"
        ? b.status
        : "other";
  return {
    status,
    serviceName: (b.service as unknown as { name: string } | null)?.name ?? null,
    startsAt: b.starts_at,
    timezone: settings.data?.timezone ?? "Europe/London",
    depositPence: b.deposit_pence,
    depositStatus: b.deposit_status,
  };
}
