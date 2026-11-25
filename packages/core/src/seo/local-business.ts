import type { DayKey, WeeklyHours } from "../booking/config";

// The business described for search engines on its booking home (schema.org
// LocalBusiness, as an AutoWash: every trade here cleans cars), so a search
// for a valeter nearby can show its name, area, hours, prices and phone.
// Only what the business has set; nothing is made up or estimated. Pure, so
// it can be tested.

const DAYS: Record<DayKey, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export type LocalBusinessInput = {
  name: string;
  url: string;
  description?: string | null;
  telephone?: string | null;
  email?: string | null;
  logo?: string | null;
  image?: string | null;
  // The premises, for a business customers can drive to.
  address?: { street?: string | null; postcode?: string | null } | null;
  // Towns and places it goes out to.
  areaServed?: string[];
  hours?: WeeklyHours | null;
  // Starting prices, in pence, for a price range.
  prices?: number[];
  // The business's own website, as another page about the same business.
  website?: string | null;
};

const pounds = (pence: number) => `£${Number.isInteger(pence / 100) ? pence / 100 : (pence / 100).toFixed(2)}`;

export function localBusinessJsonLd(input: LocalBusinessInput) {
  const hours = input.hours
    ? (Object.keys(DAYS) as DayKey[]).flatMap((day) =>
        (input.hours![day] ?? []).map(([opens, closes]) => ({
          "@type": "OpeningHoursSpecification",
          dayOfWeek: `https://schema.org/${DAYS[day]}`,
          opens,
          closes,
        })),
      )
    : [];
  const prices = (input.prices ?? []).filter((p) => p > 0);
  const low = prices.length ? Math.min(...prices) : null;
  const high = prices.length ? Math.max(...prices) : null;
  const street = input.address?.street?.trim();
  const postcode = input.address?.postcode?.trim();

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "AutoWash",
    name: input.name,
    url: input.url,
    description: input.description?.trim() || undefined,
    telephone: input.telephone || undefined,
    email: input.email || undefined,
    logo: input.logo || undefined,
    image: input.image || input.logo || undefined,
    priceRange: low === null ? undefined : low === high ? `From ${pounds(low)}` : `${pounds(low)} – ${pounds(high!)}`,
    currenciesAccepted: "GBP",
    address:
      street || postcode
        ? { "@type": "PostalAddress", streetAddress: street || undefined, postalCode: postcode || undefined, addressCountry: "GB" }
        : undefined,
    areaServed: input.areaServed?.length ? input.areaServed.map((name) => ({ "@type": "Place", name })) : undefined,
    openingHoursSpecification: hours.length ? hours : undefined,
    sameAs: input.website ? [input.website] : undefined,
  };
  // Blank fields left out rather than sent empty.
  for (const key of Object.keys(data)) if (data[key] === undefined) delete data[key];
  return data;
}

// Ready for a <script type="application/ld+json">: "<" escaped, so text the
// business typed can't close the script tag.
export function jsonLdText(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
