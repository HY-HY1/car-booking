import { buildCatalog } from "@leadgen/core/api/catalog";
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
