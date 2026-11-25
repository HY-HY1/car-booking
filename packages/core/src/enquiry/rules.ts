import { z } from "zod";
import { looksLikeLink, NAME_HAS_LINK, normalizePhone, normalizePostcode } from "../customer-fields";

// The enquiry form on a business's booking site: for jobs the instant quote
// doesn't fit (paint correction, a fleet, something unusual). Each one is
// saved as a lead with the answers, so it shows under Leads like any other.
// Pure, so it can be tested.

export const MAX_ENQUIRY_MESSAGE = 2000;
const MAX_LINKS = 2;
const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2}$/;

export const enquirySchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(200, "Keep your name under 200 characters.").refine((v) => !looksLikeLink(v), NAME_HAS_LINK),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  phone: z
    .string()
    .trim()
    .default("")
    .refine((v) => !v || normalizePhone(v) !== null, "Enter a valid phone number, or leave it blank.")
    .transform((v) => (v ? normalizePhone(v) : null)),
  postcode: z
    .string()
    .trim()
    .default("")
    .refine((v) => !v || UK_POSTCODE.test(normalizePostcode(v)), "Enter a full UK postcode, or leave it blank.")
    .transform((v) => (v ? normalizePostcode(v) : null)),
  // What it's about: a service's name, or "Something else".
  topic: z.string().trim().max(100).default(""),
  vehicle: z.string().trim().max(100, "Keep the vehicle under 100 characters.").default(""),
  message: z
    .string()
    .trim()
    .min(10, "Tell them a little about what you need.")
    .max(MAX_ENQUIRY_MESSAGE, `Keep it under ${MAX_ENQUIRY_MESSAGE.toLocaleString("en-GB")} characters.`)
    // A message full of links is almost always spam.
    .refine((v) => (v.match(/https?:\/\/|www\./gi) ?? []).length <= MAX_LINKS, "Leave out the web links, and describe the job instead."),
});
export type Enquiry = z.output<typeof enquirySchema>;

// The answers as the lead keeps them, in the order the owner reads them;
// blanks left out.
export function enquiryAnswers(e: Enquiry): { question: string; answer: string }[] {
  return [
    { question: "About", answer: e.topic },
    { question: "Vehicle", answer: e.vehicle },
    { question: "Postcode", answer: e.postcode ?? "" },
    { question: "Message", answer: e.message.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n") },
  ].filter((a) => a.answer);
}
