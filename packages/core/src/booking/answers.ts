import { z } from "zod";

// Everything else the booking page asks beyond the price: what the car needs,
// how to reach the customer, how they found the business. No server imports,
// so the booking form and the admin panel share the same keys and labels.
// Stored inside quote_snapshot.answers (leads and bookings), so no column.

export const CONCERNS = {
  pet_hair: "Pet hair",
  stains: "Stains or spills",
  smoke: "Smoke or odours",
  mould: "Damp or mould",
  scratches: "Scratches or swirl marks",
  child_seats: "Child seats fitted",
  heavy_dirt: "Mud or heavy dirt",
  headlights: "Cloudy headlights",
} as const;
export type Concern = keyof typeof CONCERNS;

export const HANDOVER = {
  present: "I'll be there",
  unlocked: "Car left unlocked, key not needed",
  keys_left: "Keys left with someone else",
  wait: "I'll wait while it's done",
  collect_later: "Drop off and collect later",
} as const;
export type Handover = keyof typeof HANDOVER;
export const MOBILE_HANDOVER: Handover[] = ["present", "unlocked", "keys_left"];
export const UNIT_HANDOVER: Handover[] = ["wait", "collect_later"];

export const CONTACT_METHODS = {
  phone: "Phone call",
  text: "Text message",
  whatsapp: "WhatsApp",
  email: "Email",
} as const;
export type ContactMethod = keyof typeof CONTACT_METHODS;

export const HEARD_FROM = {
  google: "Google",
  instagram: "Instagram",
  facebook: "Facebook",
  friend: "Friend or family",
  saw_van: "Saw the van",
  used_before: "Used you before",
  other: "Something else",
} as const;
export type HeardFrom = keyof typeof HEARD_FROM;

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || undefined);

// The extras the form collects. Every one is optional except the consent,
// which the booking (not the early lead) insists on.
export const detailsSchema = z.object({
  colour: text(40),
  year: z.number().int().min(1950).max(2100).optional(),
  concerns: z.array(z.enum(Object.keys(CONCERNS) as [Concern, ...Concern[]])).max(20).default([]),
  handover: z.enum(Object.keys(HANDOVER) as [Handover, ...Handover[]]).optional(),
  contactMethod: z.enum(Object.keys(CONTACT_METHODS) as [ContactMethod, ...ContactMethod[]]).optional(),
  heardFrom: z.enum(Object.keys(HEARD_FROM) as [HeardFrom, ...HeardFrom[]]).optional(),
  // Happy to be moved to an earlier time if one opens up.
  flexible: z.boolean().default(false),
  acceptedTerms: z.boolean().default(false),
});
export type Details = z.output<typeof detailsSchema>;
export type DetailsInput = z.input<typeof detailsSchema>;

// What gets stored beside the quote: the whole form as the customer filled it,
// with the consent turned into the moment it was given.
export const storedAnswersSchema = z.object({
  vehicle: z
    .object({
      make: z.string().optional(),
      model: z.string().optional(),
      registration: z.string().optional(),
    })
    .optional(),
  access: z
    .object({
      water: z.string().optional(),
      power: z.string().optional(),
      parking: z.string().optional(),
      carLocation: z.string().optional(),
    })
    .optional(),
  notes: z.string().optional(),
  details: detailsSchema.omit({ acceptedTerms: true }).partial().optional(),
  termsAcceptedAt: z.string().optional(),
});
export type StoredAnswers = z.infer<typeof storedAnswersSchema>;

// Reads answers back out of a frozen snapshot, tolerating old rows (no
// answers at all) and anything that doesn't fit.
export function answersOf(snapshot: unknown): StoredAnswers | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const raw = (snapshot as { answers?: unknown }).answers;
  if (!raw) return null;
  const parsed = storedAnswersSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
