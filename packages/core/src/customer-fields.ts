// Customer types, labels and formatting. No server imports, so client
// components can use these too.

export type MarketingBasis = "consent" | "soft_opt_in";

export type Customer = {
  id: string;
  tenant_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address_line: string | null;
  postcode: string | null;
  notes: string | null;
  source: string;
  email_marketing: boolean;
  sms_marketing: boolean;
  whatsapp_marketing: boolean;
  marketing_basis: MarketingBasis | null;
  marketing_updated_at: string | null;
  anonymised_at: string | null;
  created_at: string;
  updated_at: string;
};

export const CUSTOMER_SOURCES = {
  manual: "Added by you",
  booking_page: "Booking page",
  phone: "Phone call",
  instagram: "Instagram",
  facebook: "Facebook",
  google: "Google",
  referral: "Referral",
  other: "Other",
} as const;

export const MARKETING_BASES: Record<MarketingBasis, string> = {
  consent: "They opted in",
  soft_opt_in: "Soft opt-in (existing customer, offered an opt-out)",
};

// UK-first phone normalisation to E.164: "07700 900123" → "+447700900123".
export function normalizePhone(input: string): string | null {
  let value = input.replace(/[\s\-().]/g, "");
  if (value.startsWith("00")) value = "+" + value.slice(2);
  else if (value.startsWith("0")) value = "+44" + value.slice(1);
  else if (value.startsWith("44")) value = "+" + value;
  return /^\+[1-9]\d{6,14}$/.test(value) ? value : null;
}

// "+447700900123" → "07700 900123"; other countries are shown as stored.
export function formatPhone(phone: string): string {
  if (phone.startsWith("+44") && phone.length === 13) {
    const national = "0" + phone.slice(3);
    return `${national.slice(0, 5)} ${national.slice(5)}`;
  }
  return phone;
}

// "sw1a1aa" → "SW1A 1AA". Leaves anything that isn't a UK postcode as typed.
export function normalizePostcode(input: string): string {
  const compact = input.replace(/\s/g, "").toUpperCase();
  return /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(compact)
    ? `${compact.slice(0, -3)} ${compact.slice(-3)}`
    : input.trim().toUpperCase();
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date(iso));
}
