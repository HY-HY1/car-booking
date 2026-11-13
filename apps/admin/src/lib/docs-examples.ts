import { buildCatalog } from "@leadgen/core/api/catalog";
import { encodeCursor } from "@leadgen/core/api/query";
import { bookingResource, customerResource, leadResource, quoteResource, type BookingRow } from "@leadgen/core/api/resources";
import type { Business, Webhook } from "@leadgen/core/api/types";
import type { AddOn, ConditionTier, Service } from "@leadgen/core/booking/config";
import { getQuote, type PricingSettings } from "@leadgen/core/booking/pricing";

// A made-up business for the docs' worked examples. The examples are produced
// by the real pricing and catalogue code, so they can't drift from it.

export const EXAMPLE_BOOKING_URL = "https://book.shinedetailing.co.uk";

const fullValet: Service = {
  id: "6f1c2a4e-8b3d-4c1a-9e2f-0a1b2c3d4e5f",
  name: "Full valet",
  slug: "full-valet",
  tagline: "Inside and out in one visit",
  description: "A proper clean inside and out for a car that's due one.",
  badge: "Most popular",
  duration_mins: 180,
  base_price_pence: 8500,
  size_adjustments: {
    large: { price_pence: 2000, extra_mins: 30 },
    xl: { price_pence: 3500, extra_mins: 45 },
  },
  location_types: ["mobile", "unit"],
  image_path: "example/full-valet/hero.jpg",
  gallery: ["example/full-valet/1.jpg", "example/full-valet/2.jpg"],
  includes: ["Snow foam and hand wash", "Wheels and tyres cleaned", "Hoover and wipe down inside", "Windows inside and out"],
  not_included: ["Machine polishing"],
  steps: [{ title: "Pre-wash", text: "Snow foam lifts the worst of the dirt before anything touches the paint." }],
  faqs: [{ q: "Do you need water and power?", a: "An outside tap and socket help. Tell us when you book if you don't have them." }],
  body: null,
  seo_title: "Full valet in Bristol",
  seo_description: "Mobile full valet, inside and out, at your home or work.",
};

const petHair: AddOn = {
  id: "8d2e4f6a-1b3c-4d5e-8f7a-9b0c1d2e3f4a",
  name: "Pet hair removal",
  description: "For dogs that shed.",
  price_pence: 1550,
  duration_mins: 20,
  service_ids: null,
};

export const exampleTiers: ConditionTier[] = [
  { key: "light", label: "Light: just needs a clean", multiplier: 1, extra_mins: 0, needs_inspection: false },
  { key: "heavy", label: "Heavy: mud, sand or lots of pet hair", multiplier: 1.25, extra_mins: 45, needs_inspection: false },
  { key: "severe", label: "Very bad: mould or spills left for weeks", multiplier: 1, extra_mins: 0, needs_inspection: true },
];

export const exampleSettings: PricingSettings = {
  offers_mobile: true,
  offers_unit: true,
  deposit: { type: "percent", value: 25 },
  min_price_pence: 5000,
  mobile_surcharge_pence: 1000,
  condition_tiers: exampleTiers,
};

export const exampleService = fullValet;
export const exampleAddOn = petHair;

// A large car in heavy condition, with pet hair removal, at the customer's address.
export function exampleQuote() {
  return getQuote({
    service: fullValet,
    addOns: [petHair],
    addOnIds: [petHair.id],
    sizeClass: "large",
    conditionKey: "heavy",
    locationType: "mobile",
    settings: exampleSettings,
  });
}

export function exampleCatalog() {
  return buildCatalog({
    businessName: "Shine Detailing",
    bookingUrl: EXAMPLE_BOOKING_URL,
    imageUrl: (path) => `https://example.supabase.co/storage/v1/object/public/service-images/${path}`,
    services: [fullValet],
    addOns: [petHair],
  });
}

// ------------------------------------------------------------------ API v1 examples
// Made-up rows put through the API's own serializers (api/resources.ts), so
// every example has exactly the shape the API sends.

const CUSTOMER_ID = "3b7e9f12-4c5d-4a6b-8e9f-0a1b2c3d4e5f";
const VAN_ID = "c2d4e6f8-1a3b-4c5d-9e7f-8a9b0c1d2e3f";

const exampleBookingRow: BookingRow = {
  id: "6d1f0c2a-7b9e-4e1a-9c3d-2f8b5a4e7d10",
  status: "confirmed",
  starts_at: "2026-11-20T09:00:00+00:00",
  ends_at: "2026-11-20T12:35:00+00:00",
  created_at: "2026-11-12T09:41:05.120+00:00",
  updated_at: "2026-11-12T09:41:06.904+00:00",
  location_type: "mobile",
  address_line: "12 Oak Road",
  postcode: "BS7 8QA",
  customer_notes: "Gate code 1234. The car's on the drive.",
  price_pence: 12000,
  deposit_pence: 3000,
  deposit_status: "paid",
  source: "booking_page",
  quote_snapshot: {
    lines: [
      { label: "Full valet", amount_pence: 8500 },
      { label: "Large vehicle", amount_pence: 2000 },
      { label: "Pet hair removal", amount_pence: 1500 },
    ],
    needs_inspection: false,
  },
  service: { id: fullValet.id, name: fullValet.name },
  customer: { id: CUSTOMER_ID, name: "Sam Price", email: "sam@example.com", phone: "+447700900123" },
  vehicle: { make: "Volvo", model: "XC60", registration: "AB12CDE", size_class: "large" },
  resource: { id: VAN_ID, name: "Van 1" },
  staff: null,
};

export const exampleBooking = () => bookingResource(exampleBookingRow);

export const exampleLead = () =>
  leadResource({
    id: "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
    status: "new",
    source: "website",
    external_id: "api:contact-2291",
    created_at: "2026-11-12T14:02:11.300+00:00",
    updated_at: "2026-11-12T14:02:11.300+00:00",
    quote_snapshot: { service_id: fullValet.id, service_name: fullValet.name, postcode: "BS7 8QA" },
    form_answers: {
      form: "Contact page",
      answers: [
        { question: "Message", answer: "Can you do a full valet on a 7-seater next week?" },
        { question: "Best time to call", answer: "Evenings" },
      ],
    },
    customer: { id: CUSTOMER_ID, name: "Sam Price", email: "sam@example.com", phone: "+447700900123" },
  });

export const exampleCustomer = () =>
  customerResource({
    id: CUSTOMER_ID,
    name: "Sam Price",
    email: "sam@example.com",
    phone: "+447700900123",
    address_line: "12 Oak Road",
    postcode: "BS7 8QA",
    source: "booking_page",
    email_marketing: true,
    sms_marketing: false,
    whatsapp_marketing: false,
    created_at: "2026-09-03T18:20:41.000+00:00",
    updated_at: "2026-11-12T09:41:05.120+00:00",
    vehicles: [
      { id: "f1e2d3c4-b5a6-4978-8a9b-0c1d2e3f4a5b", make: "Volvo", model: "XC60", registration: "AB12CDE", size_class: "large", created_at: "2026-09-03T18:20:41.000+00:00" },
    ],
  });

// A quote from the API: no photos, so the condition can't be judged and a
// business with condition levels gets needsInspection.
export const exampleApiQuote = () =>
  quoteResource(
    getQuote({
      service: fullValet,
      addOns: [petHair],
      addOnIds: [petHair.id],
      sizeClass: "large",
      conditionKey: null,
      locationType: "unit",
      settings: exampleSettings,
    }),
    `${EXAMPLE_BOOKING_URL}/quote?service=${fullValet.id}`,
  );

const weekdays = [{ opens: "08:00", closes: "18:00" }];
export const exampleBusiness: Business = {
  name: "Shine Detailing",
  tagline: "Mobile valeting across Bristol",
  bookingUrl: EXAMPLE_BOOKING_URL,
  websiteUrl: "https://shinedetailing.co.uk",
  contact: { email: "hello@shinedetailing.co.uk", phone: "+441179000123" },
  branding: {
    logoUrl: "https://example.supabase.co/storage/v1/object/public/service-images/example/brand/logo.webp",
    coverUrl: null,
    primaryColor: "#0f172a",
    accentColor: "#22c55e",
  },
  locations: { mobile: true, unit: { address: "Unit 4, Mill Lane", postcode: "BS3 2LP" } },
  openingHours: {
    mobile: {
      monday: weekdays,
      tuesday: weekdays,
      wednesday: weekdays,
      thursday: weekdays,
      friday: weekdays,
      saturday: [{ opens: "09:00", closes: "13:00" }],
      sunday: [],
    },
    unit: null,
  },
  booking: { approvalRequired: false, minNoticeHours: 24, maxDaysAhead: 60, deposit: { type: "percent", percent: 25 } },
  links: { terms: `${EXAMPLE_BOOKING_URL}/terms`, privacy: `${EXAMPLE_BOOKING_URL}/privacy` },
  timezone: "Europe/London",
  currency: "GBP",
};

export const exampleWebhook: Webhook = {
  id: "0e1d2c3b-4a59-4687-9a8b-7c6d5e4f3a2b",
  url: "https://hooks.zapier.com/hooks/catch/123456/abcdef/",
  description: "Zapier: new bookings to Google Sheets",
  events: ["booking.created", "booking.cancelled"],
  active: true,
  createdAt: "2026-11-12T10:15:00.000Z",
};

// Cursors are opaque: this one is just made the way the API makes them.
export const exampleCursor = encodeCursor({ after: "2026-11-20T09:00:00+00:00", id: exampleBookingRow.id });
