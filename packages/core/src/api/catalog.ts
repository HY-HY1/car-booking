import { formatPence, SIZE_CLASSES, type AddOn, type Service, type SizeClass } from "../booking/config";

// The product data a business's own website gets from /api/v1/catalog. It's a
// fixed shape, not database rows, so columns can change without breaking the
// sites that read it; anything that would change the shape means /v2.
// Product data only: no customers, bookings or anything else personal.

export type CatalogService = {
  id: string;
  slug: string | null;
  name: string;
  tagline: string | null;
  description: string | null;
  badge: string | null;
  durationMins: number;
  // Where it can be done: at the customer's address, or dropped off.
  locations: ("mobile" | "unit")[];
  price: {
    fromPence: number;
    from: string;
    // Extra price and time on top of the base, by vehicle size.
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
  // Null until the business has a booking address.
  pageUrl: string | null;
  bookUrl: string | null;
};

export type CatalogAddOn = {
  id: string;
  name: string;
  description: string | null;
  pricePence: number;
  price: string;
  durationMins: number;
  // Ids of the services it can go with; null means all of them.
  serviceIds: string[] | null;
};

export type Catalog = {
  version: 1;
  business: { name: string; bookingUrl: string | null };
  services: CatalogService[];
  addOns: CatalogAddOn[];
};

export function buildCatalog({
  businessName,
  bookingUrl,
  imageUrl,
  services,
  addOns,
}: {
  businessName: string;
  bookingUrl: string | null;
  // Storage path → public URL.
  imageUrl: (path: string) => string;
  services: Service[];
  addOns: AddOn[];
}): Catalog {
  return {
    version: 1,
    business: { name: businessName, bookingUrl },
    services: services.map((s) => ({
      id: s.id,
      slug: s.slug ?? null,
      name: s.name,
      tagline: s.tagline ?? null,
      description: s.description,
      badge: s.badge ?? null,
      durationMins: s.duration_mins,
      locations: s.location_types,
      price: {
        fromPence: s.base_price_pence,
        from: formatPence(s.base_price_pence),
        bySize: (Object.keys(SIZE_CLASSES) as SizeClass[]).flatMap((size) => {
          const adj = s.size_adjustments[size];
          return adj
            ? [{ size, label: SIZE_CLASSES[size], extraPence: adj.price_pence ?? 0, extraMins: adj.extra_mins ?? 0 }]
            : [];
        }),
      },
      image: s.image_path ? imageUrl(s.image_path) : null,
      gallery: (s.gallery ?? []).map(imageUrl),
      includes: s.includes ?? [],
      notIncluded: s.not_included ?? [],
      steps: s.steps ?? [],
      faqs: s.faqs ?? [],
      body: s.body ?? null,
      seo: { title: s.seo_title ?? null, description: s.seo_description ?? null },
      pageUrl: bookingUrl && s.slug ? `${bookingUrl}/services/${s.slug}` : null,
      bookUrl: bookingUrl ? `${bookingUrl}/quote?service=${s.id}` : null,
    })),
    addOns: addOns.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      pricePence: a.price_pence,
      price: formatPence(a.price_pence),
      durationMins: a.duration_mins,
      serviceIds: a.service_ids,
    })),
  };
}
