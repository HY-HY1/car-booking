import { z } from "zod";

// Which of the booking page's optional questions a business asks (Settings →
// Booking), stored as booking_settings.questions. Make, model and size are
// always asked: the price depends on them. Anything not stored is asked, so
// new questions appear for everyone until switched off.

export const OPTIONAL_QUESTIONS = {
  registration: "Registration number",
  colour_year: "Colour and year",
  concerns: "Anything to look at (stains, pet hair, smells…)",
  access: "Outside tap, power socket and parking (mobile jobs)",
  car_location: "Finding the car: gate codes, landmarks (mobile jobs)",
  handover: "How you'll get the car (keys left out, waiting…)",
  contact_method: "How they'd like to be contacted",
  heard_from: "How they heard about you",
  flexible: "Whether they're flexible on time",
  notes: "Anything else they want to tell you",
} as const;

export type QuestionKey = keyof typeof OPTIONAL_QUESTIONS;
export const QUESTION_KEYS = Object.keys(OPTIONAL_QUESTIONS) as QuestionKey[];

export type Questions = Record<QuestionKey, boolean>;

// Each question is read on its own, so a key from an older version (or a
// bad value) only falls back for that one question.
export function questionsOf(raw: unknown): Questions {
  const stored = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return Object.fromEntries(QUESTION_KEYS.map((k) => [k, z.boolean().catch(true).parse(stored[k])])) as Questions;
}
