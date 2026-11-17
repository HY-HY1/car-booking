// Social proof for the marketing pages: what detailers say about the product,
// and figures about it.
//
// Only real, checkable proof may go live: invented reviews and figures
// mislead customers and break UK consumer law. Entries marked `placeholder`
// stand in while the pages are designed. They show in development, tagged
// "Placeholder", and are left out of production builds. Replace each one
// with the real thing (and drop the flag) to publish it; anything a section
// needs and doesn't have, it leaves out.

type Placeholder = { placeholder?: true };

export type Testimonial = Placeholder & {
  quote: string;
  name: string;
  business: string;
  place: string;
  // How they work, e.g. "Mobile · 2 vans".
  setup: string;
};

export type Stat = Placeholder & { title: string; value: string; label: string };

export type Result = Placeholder & {
  business: string;
  place: string;
  headline: string;
  quote: { text: string; who: string };
  metrics: { label: string; before: string; after: string }[];
};

export const SHOW_PLACEHOLDERS = process.env.NODE_ENV !== "production";

function visible<T extends Placeholder>(items: T[]): T[] {
  return items.filter((item) => !item.placeholder || SHOW_PLACEHOLDERS);
}

export const TESTIMONIALS: Testimonial[] = visible<Testimonial>([
  {
    placeholder: true,
    quote:
      "I used to lose an evening a week answering “how much?” messages. Now people get a price and book themselves in while I'm on a job.",
    name: "Jordan Hale",
    business: "Hale Mobile Valeting",
    place: "Bristol",
    setup: "Mobile · 1 van",
  },
  {
    placeholder: true,
    quote:
      "Taking a deposit stopped the no-shows almost overnight. If someone books, they turn up, and if they cancel late I'm not out of pocket.",
    name: "Priya Nair",
    business: "Gleam Detailing",
    place: "Leeds",
    setup: "Mobile · 2 vans",
  },
  {
    placeholder: true,
    quote:
      "The route planner is the bit I didn't know I needed. I know when to leave for every job and I've stopped turning up late.",
    name: "Sam O'Connell",
    business: "Shineworks",
    place: "Manchester",
    setup: "Mobile and unit",
  },
]);

// The home page's figures, under the hero. Real: the owner's own detailing
// business, run on the platform (given 2026-11-17). They're one business's
// results, so STATS_SOURCE says so beside them; widen it, and the labels,
// only once other detailers' figures are counted in.
export const STATS: Stat[] = visible<Stat>([
  { title: "Repeat customers", value: "40%", label: "of customers book again" },
  { title: "Paid to detailers", value: "£12,000+", label: "paid straight to the detailer, no cut taken" },
  { title: "Fewer cancellations", value: "~3%", label: "of customers cancel" },
]);

export const STATS_SOURCE = "Figures from our own detailing business, which runs its bookings on the platform.";

// One line under the hero's buttons.
export const HERO_PROOF: (Placeholder & { text: string }) | null =
  visible([{ placeholder: true as const, text: "Used by 40+ mobile detailers and valeters across the UK" }])[0] ?? null;

// One detailer's before and after, in their own figures.
export const RESULT: Result | null =
  visible<Result>([
    {
      placeholder: true,
      business: "Hale Mobile Valeting",
      place: "Bristol",
      headline: "Six months in: no no-shows, and evenings back",
      quote: {
        text: "I'd been putting off a booking system because I thought it'd take weeks to set up. I was taking deposits the same afternoon.",
        who: "Jordan Hale, owner",
      },
      metrics: [
        { label: "No-shows a month", before: "3–4", after: "0" },
        { label: "Hours a week on messages", before: "6", after: "1" },
        { label: "Bookings made outside working hours", before: "–", after: "41%" },
      ],
    },
  ])[0] ?? null;
