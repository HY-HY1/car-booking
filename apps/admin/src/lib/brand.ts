// The product's public name and contact, as the landing page shows them.
// The company behind it (legal pages, invoices) is PLATFORM in
// @leadgen/core/privacy/platform.

export const PRODUCT_NAME = "Kerbside";

// Where "Ask about a website" goes: custom websites built to plug into the
// booking system are quoted per project.
export const SALES_EMAIL = "harvey@ascnddetailing.co.uk";

// A business using the product, shown on the landing page as proof. Only
// real, checkable facts go here: the page shows the quote and the before /
// after numbers once they're filled in, and leaves those parts out until then.
export const CASE_STUDY = {
  name: "ASCND Detailing",
  place: "Cheltenham",
  url: "https://book.ascnddetailing.co.uk",
  since: "October 2026",
  // From its live booking page.
  services: ["Maintenance wash from £45", "Full valet from £60", "Ceramic coating from £295"],
  // The owner's own words, e.g. { text: "…", who: "Harvey, owner" }.
  quote: null as { text: string; who: string } | null,
  // The owner's own figures, before the product and with it, e.g.
  // { label: "No-shows a month", before: "3–4", after: "0" }.
  metrics: [] as { label: string; before: string; after: string }[],
};
