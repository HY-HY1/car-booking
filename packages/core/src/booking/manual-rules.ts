import { z } from "zod";
import { normalizePhone, normalizePostcode } from "../customer-fields";
import { locationTypeSchema, sizeClassSchema, type DepositRule } from "./config";
import { isUkPostcode } from "./geo";
import { depositFor, type Quote, type QuoteLine } from "./pricing";
import { isIsoDate } from "./time";

// A booking the business adds itself (Diary → Add booking): parsing the form
// and settling the price. No database access, so it can be tested. Values
// come in as strings, as a browser sends them.

const optional = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `Keep ${label} under ${max} characters.`)
    .default("")
    .transform((v) => v || null);

// "12.50" / "£12.50" → 1250. Blank → null (use what the price list says).
const pounds = (label: string) =>
  z
    .string()
    .trim()
    .default("")
    .transform((v) => v.replace(/^£/, ""))
    .refine((v) => v === "" || (/^\d+(\.\d{1,2})?$/.test(v) && Number(v) <= 100_000), {
      message: `Enter ${label} in pounds, like 25 or 12.50.`,
    })
    .transform((v) => (v === "" ? null : Math.round(Number(v) * 100)));

export const manualBookingFormSchema = z
  .object({
    // An existing customer (from "Book again" on their page), or found or
    // added from the details below.
    customer_id: z.string().trim().default(""),
    name: z.string().trim().min(1, "Enter the customer's name.").max(200, "Keep the name under 200 characters."),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .default("")
      .refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email address, or leave it blank."),
    phone: z
      .string()
      .trim()
      .default("")
      .refine((v) => v === "" || normalizePhone(v) !== null, "Enter a valid phone number, or leave it blank."),

    service_id: z.uuid("Pick a service."),
    size_class: sizeClassSchema,
    condition_key: z.string().trim().default(""),
    // Comma-separated, from the form's tickboxes.
    add_on_ids: z.string().default(""),
    location_type: locationTypeSchema,
    address_line: optional(300, "the address"),
    postcode: z.string().trim().default(""),

    date: z.string().trim().refine(isIsoDate, "Pick a date."),
    time: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Pick a start time."),
    // "" = the first van or bay that's free.
    resource_id: z.string().trim().default(""),
    duration_mins: z
      .string()
      .trim()
      .default("")
      .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) >= 15 && Number(v) <= 1440), {
        message: "The length must be from 15 to 1440 minutes, or blank for the usual.",
      })
      .transform((v) => (v === "" ? null : Number(v))),
    price: pounds("the price"),
    deposit: pounds("the deposit"),

    make: optional(60, "the make"),
    model: optional(60, "the model"),
    registration: optional(10, "the registration").transform((v) => v?.replace(/\s/g, "").toUpperCase() || null),
    notes: optional(1000, "the notes"),

    send_confirmation: z
      .string()
      .optional()
      .transform((v) => v === "on"),
    request_deposit: z
      .string()
      .optional()
      .transform((v) => v === "on"),
  })
  .transform((v, ctx) => {
    const problem = (path: string, message: string) => {
      ctx.addIssue({ code: "custom", path: [path], message });
      return z.NEVER;
    };
    if (v.customer_id && !z.uuid().safeParse(v.customer_id).success) return problem("name", "Pick the customer again.");
    if (v.resource_id && !z.uuid().safeParse(v.resource_id).success) return problem("resource_id", "Pick a van or bay.");
    const addOnIds = v.add_on_ids.split(",").map((s) => s.trim()).filter(Boolean);
    if (addOnIds.some((id) => !z.uuid().safeParse(id).success)) return problem("add_on_ids", "Pick the extras again.");

    let postcode: string | null = null;
    if (v.location_type === "mobile") {
      if (!isUkPostcode(v.postcode)) return problem("postcode", "Enter the full postcode where the car will be, like BS1 4DJ.");
      postcode = normalizePostcode(v.postcode);
    }
    if (v.deposit !== null && v.price !== null && v.deposit > v.price) {
      return problem("deposit", "The deposit can't be more than the price.");
    }
    if (v.request_deposit && !v.email) return problem("email", "Add their email address to send them the deposit request.");

    return {
      customerId: v.customer_id || null,
      contact: { name: v.name, email: v.email || null, phone: v.phone ? normalizePhone(v.phone)! : null },
      serviceId: v.service_id,
      sizeClass: v.size_class,
      conditionKey: v.condition_key || null,
      addOnIds,
      locationType: v.location_type,
      addressLine: v.location_type === "mobile" ? v.address_line : null,
      postcode,
      date: v.date,
      time: v.time,
      resourceId: v.resource_id || null,
      durationMins: v.duration_mins,
      pricePence: v.price,
      depositPence: v.deposit,
      vehicle: { make: v.make, model: v.model, registration: v.registration },
      notes: v.notes,
      sendConfirmation: v.send_confirmation,
      requestDeposit: v.request_deposit,
    };
  });
export type ManualBooking = z.output<typeof manualBookingFormSchema>;

// The price list's quote, with the owner's own price, length and deposit
// where they gave one. A changed price shows as its own line, so the lines
// still add up to the total on the booking.
export function settleManualPrice(
  quote: Quote,
  depositRule: DepositRule,
  overrides: { pricePence: number | null; durationMins: number | null; depositPence: number | null },
): { lines: QuoteLine[]; totalPence: number; depositPence: number; durationMins: number } {
  const lines = [...quote.lines];
  let total = quote.total_pence;
  if (overrides.pricePence !== null && overrides.pricePence !== total) {
    lines.push({ label: "Price adjusted", amount_pence: overrides.pricePence - total });
    total = overrides.pricePence;
  }
  return {
    lines,
    totalPence: total,
    // The business's usual deposit, on the price it's charging.
    depositPence: Math.min(overrides.depositPence ?? depositFor(total, depositRule), total),
    durationMins: overrides.durationMins ?? quote.duration_mins,
  };
}
