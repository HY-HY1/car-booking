// Who is who, and who else touches the data. Shared by the privacy notice on
// every booking page, ASCND's own policies and the data processing terms, so
// they can't drift apart.
//
// ASCND's own details come from the root .env.local (public vars, so both
// apps can show them). Until they're set the pages say "ASCND" and show no
// address or ICO number; fill them in before taking real customers.

export const PLATFORM = {
  name: process.env.NEXT_PUBLIC_LEGAL_NAME || "ASCND",
  address: process.env.NEXT_PUBLIC_LEGAL_ADDRESS || null,
  companyNumber: process.env.NEXT_PUBLIC_COMPANY_NUMBER || null,
  icoRegistration: process.env.NEXT_PUBLIC_ICO_NUMBER || null,
  privacyEmail: process.env.NEXT_PUBLIC_PRIVACY_EMAIL || null,
};

// Bump when the terms or data processing terms change in a way owners must
// re-accept. Stored on the tenant at signup.
export const TERMS_VERSION = "2026-10-23";

export type Subprocessor = { name: string; does: string; data: string };

// Companies that process personal data on the platform's behalf. Add to this
// list (and tell customers) before switching on a new one, such as an email
// or WhatsApp provider or an AI model.
export const SUBPROCESSORS: Subprocessor[] = [
  {
    name: "Supabase",
    does: "Database, file storage and sign-in",
    data: "Everything entered in bookings and the dashboard, including photos",
  },
  {
    name: "Vercel",
    does: "Hosting for the booking pages and dashboard",
    data: "Requests to the sites, including IP addresses in server logs",
  },
  {
    name: "Stripe",
    does: "Card payments and subscription billing",
    data: "Name, email and payment details for deposits and subscriptions. Card numbers go straight to Stripe and are never seen by the business or the platform",
  },
  {
    name: "postcodes.io",
    does: "Postcode lookups for service area and travel time",
    data: "Postcodes only, with no name or contact details",
  },
  {
    name: "Anthropic",
    does: "Checks photos of the car to work out its condition for the quote",
    data: "The photos the customer adds while booking, with no name or contact details",
  },
];
