import { z } from "zod";
import { normalizePhone } from "../customer-fields";
import type { DepositRule } from "../booking/config";
import { ASSISTANT_MODES, ASSISTANT_TONES, type AssistantMode, type AssistantSettings, type AssistantTone } from "./assistant";
import { CUSTOMER_MESSAGES, type CustomerMessage, type NotificationSettings, unknownFields } from "./notifications";
import { DEFAULT_POLICY, type CancellationPolicy, type LateFee } from "./policy";
import { QUESTION_KEYS, type Questions } from "./questions";

// Parsing the Settings forms' posts into the rows they update. Values come in
// as strings, as a browser sends them; a checkbox is "on" or missing. No
// database access, so it can be tested.

const checkbox = z
  .string()
  .optional()
  .transform((v) => v === "on");

const text = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `Keep ${label} under ${max} characters.`)
    .default("");

function whole(label: string, min: number, max: number) {
  return z
    .string()
    .trim()
    .refine((v) => /^\d+$/.test(v) && Number(v) >= min && Number(v) <= max, {
      message: `${label} must be a whole number from ${min} to ${max}.`,
    })
    .transform(Number);
}

// "12.50" / "£12.50" → 1250. Blank → null.
function pounds(label: string) {
  return z
    .string()
    .trim()
    .transform((v) => v.replace(/^£/, ""))
    .refine((v) => v === "" || (/^\d+(\.\d{1,2})?$/.test(v) && Number(v) <= 100_000), {
      message: `Enter ${label} in pounds, like 25 or 12.50.`,
    })
    .transform((v) => (v === "" ? null : Math.round(Number(v) * 100)));
}

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email address.")
  .transform((v) => v || null);

// What an owner types → a full URL: anything without a scheme gets https://.
// http(s) only, as these are rendered as links.
export function normalizeUrl(input: string) {
  const v = input.trim();
  if (!v) return "";
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) return v;
  return /^localhost(:\d+)?(\/|$)/i.test(v) ? `http://${v}` : `https://${v}`;
}

const optionalUrl = z
  .string()
  .transform(normalizeUrl)
  .refine((v) => v === "" || (/^https?:\/\//i.test(v) && z.url().safeParse(v).success), "Enter a web address, like https://yourwebsite.co.uk.")
  .transform((v) => v || null);

// ------------------------------------------------------------------ General

export const TRADES = {
  detailing: "Detailer",
  valeting: "Valeter",
  both: "Both",
} as const;

// The time zones a UK or Irish business might work in. Availability, the
// diary and every time shown to customers use this.
export const TIMEZONES = {
  "Europe/London": "UK (London)",
  "Europe/Dublin": "Ireland (Dublin)",
  "Europe/Jersey": "Jersey",
  "Europe/Guernsey": "Guernsey",
  "Europe/Isle_of_Man": "Isle of Man",
} as const;

// GB123456789, GB123456789001, GBGD123, GBHA123; spaces and the GB optional.
const VAT = /^(GB)?(\d{9}|\d{12}|GD\d{3}|HA\d{3})$/;

export const generalFormSchema = z
  .object({
    name: z.string().trim().min(1, "Enter the business name.").max(100, "Keep the name under 100 characters."),
    contact_email: optionalEmail,
    contact_phone: z.string().trim().default(""),
    trade: z.enum(Object.keys(TRADES) as [keyof typeof TRADES, ...(keyof typeof TRADES)[]], "Pick what you do."),
    timezone: z.enum(Object.keys(TIMEZONES) as [keyof typeof TIMEZONES, ...(keyof typeof TIMEZONES)[]], "Pick a time zone."),
    vat_registered: checkbox,
    vat_number: z.string().default(""),
  })
  .transform((v, ctx) => {
    const problem = (path: string, message: string) => {
      ctx.addIssue({ code: "custom", path: [path], message });
      return z.NEVER;
    };
    let phone: string | null = null;
    if (v.contact_phone) {
      phone = normalizePhone(v.contact_phone);
      if (!phone) return problem("contact_phone", "Enter a valid phone number.");
    }
    let vat: string | null = null;
    if (v.vat_registered) {
      const cleaned = v.vat_number.replace(/\s/g, "").toUpperCase();
      if (!cleaned) return problem("vat_number", "Enter your VAT number, or untick VAT registered.");
      if (!VAT.test(cleaned)) return problem("vat_number", "That doesn't look like a UK VAT number, e.g. GB123456789.");
      vat = cleaned.startsWith("GB") ? cleaned : `GB${cleaned}`;
    }
    return {
      tenant: {
        name: v.name,
        contact_email: v.contact_email,
        contact_phone: phone,
        trade: v.trade,
        vat_number: vat,
      },
      timezone: v.timezone,
    };
  });

// ------------------------------------------------------------ Booking page

const hexColor = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a colour like #0f172a.");

export const BUTTON_POSITIONS = { right: "Bottom right", left: "Bottom left" } as const;

export const brandingFormSchema = z.object({
  primary_color: hexColor,
  accent_color: hexColor,
  // Blank clears it.
  secondary_color: z.union([z.literal(""), hexColor]).optional().transform((v) => v || undefined),
  tagline: text(120, "the tagline").transform((v) => v || undefined),
  website_url: optionalUrl.transform((v) => v ?? undefined),
  button_label: text(30, "the button text").transform((v) => v || undefined),
  button_position: z.enum(["right", "left"]).default("right"),
});
export type BrandingForm = z.output<typeof brandingFormSchema>;

// ------------------------------------------------------------------ Booking

const askingFieldsSchema = z.object({
  photos_required: checkbox,
  min_photos: whole("Photos", 1, 6),
  approval_mode: z.enum(["auto", "manual"], "Pick how new bookings are handled."),
});

// Photos, approval and which questions are asked. Each question is a
// checkbox named q_<key>: missing means switched off.
export const askingFormSchema = z
  .record(z.string(), z.string())
  .transform((input, ctx) => {
    const parsed = askingFieldsSchema.safeParse(input);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) ctx.addIssue({ code: "custom", path: issue.path, message: issue.message });
      return z.NEVER;
    }
    return {
      ...parsed.data,
      questions: Object.fromEntries(QUESTION_KEYS.map((k) => [k, input[`q_${k}`] === "on"])) as Questions,
    };
  });

// Cut-offs and the note (Settings → Booking). The refund side is kept as it
// was, or the default, so the two forms can't undo each other.
export function parsePolicyForm(input: Record<string, string>, current: CancellationPolicy | null) {
  const schema = z.object({
    policy_enabled: checkbox,
    cutoff_hours: whole("The cancellation notice", 0, 720),
    reschedule_cutoff_hours: whole("The notice to change the time", 0, 720),
    note: text(500, "the note"),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return parsed;
  const v = parsed.data;
  const policy: CancellationPolicy | Record<string, never> = v.policy_enabled
    ? {
        ...(current ?? DEFAULT_POLICY),
        cutoff_hours: v.cutoff_hours,
        reschedule_cutoff_hours: v.reschedule_cutoff_hours,
        note: v.note || undefined,
      }
    : {};
  return { success: true as const, data: policy };
}

// What happens to the deposit (Settings → Payments). Only once a policy exists.
export function parseRefundForm(input: Record<string, string>, current: CancellationPolicy) {
  const schema = z
    .object({
      refund_before_cutoff: z.enum(["full", "none"]),
      late_fee_type: z.enum(["deposit", "fixed", "none"]),
      late_fee_amount: pounds("the amount kept"),
    })
    .transform((v, ctx) => {
      let late_fee: LateFee = { type: v.late_fee_type } as LateFee;
      if (v.late_fee_type === "fixed") {
        if (v.late_fee_amount === null) {
          ctx.addIssue({ code: "custom", path: ["late_fee_amount"], message: "Enter how much of the deposit you keep." });
          return z.NEVER;
        }
        late_fee = { type: "fixed", value_pence: v.late_fee_amount };
      }
      return { ...current, refund_before_cutoff: v.refund_before_cutoff, late_fee } satisfies CancellationPolicy;
    });
  return schema.safeParse(input);
}

// ------------------------------------------------------------------ Payments

export const depositFormSchema = z
  .object({
    deposit_type: z.enum(["none", "percent", "fixed", "full"]),
    deposit_percent: z.string().trim().default(""),
    deposit_fixed: pounds("a deposit"),
  })
  .transform((v, ctx): DepositRule => {
    if (v.deposit_type === "percent") {
      const value = Number(v.deposit_percent);
      if (!/^\d+(\.\d+)?$/.test(v.deposit_percent) || value <= 0 || value > 100) {
        ctx.addIssue({ code: "custom", path: ["deposit_percent"], message: "Enter a percentage from 1 to 100." });
        return z.NEVER;
      }
      return { type: "percent", value };
    }
    if (v.deposit_type === "fixed") {
      if (!v.deposit_fixed) {
        ctx.addIssue({ code: "custom", path: ["deposit_fixed"], message: "Enter the deposit in pounds." });
        return z.NEVER;
      }
      return { type: "fixed", value_pence: v.deposit_fixed };
    }
    return { type: v.deposit_type };
  });

// ------------------------------------------------------------- Notifications

const MESSAGE_KEYS = Object.keys(CUSTOMER_MESSAGES) as CustomerMessage[];

const notificationFieldsSchema = z.object({
  channel_email: checkbox,
  channel_sms: checkbox,
  sender_name: text(60, "the sender name"),
  reply_to: optionalEmail,
  reminder_hours_before: whole("The reminder time", 1, 168),
  follow_up_days_after: whole("The follow-up delay", 1, 60),
  review_request_days_after: whole("The review request delay", 0, 30),
  review_url: optionalUrl,
  alerts_new_lead: checkbox,
  alerts_new_booking: checkbox,
  alerts_cancellation: checkbox,
  alerts_email: optionalEmail,
});

const subjectSchema = z.string().trim().min(1, "Give the message a subject.").max(150, "Keep the subject under 150 characters.");
const bodySchema = z.string().trim().min(1, "The message can't be empty.").max(3000, "Keep the message under 3,000 characters.");

type FieldIssue = { path: string; message: string };

// Each message's fields are named <message>_enabled, _subject and _body.
export function parseNotificationsForm(input: Record<string, string>):
  | { success: true; data: NotificationSettings }
  | { success: false; error: { issues: { path: string[]; message: string }[] } } {
  const fail = (issues: FieldIssue[]) => ({
    success: false as const,
    error: { issues: issues.map((i) => ({ path: [i.path], message: i.message })) },
  });

  const fields = notificationFieldsSchema.safeParse(input);
  if (!fields.success) {
    return fail(fields.error.issues.map((i) => ({ path: String(i.path[0] ?? "form"), message: i.message })));
  }
  const v = fields.data;

  const messages = {} as Record<CustomerMessage, { enabled: boolean; subject: string; body: string }>;
  for (const k of MESSAGE_KEYS) {
    const subject = subjectSchema.safeParse(input[`${k}_subject`] ?? "");
    if (!subject.success) return fail([{ path: `${k}_subject`, message: subject.error.issues[0].message }]);
    const body = bodySchema.safeParse(input[`${k}_body`] ?? "");
    if (!body.success) return fail([{ path: `${k}_body`, message: body.error.issues[0].message }]);
    for (const [part, value] of [["subject", subject.data], ["body", body.data]] as const) {
      const bad = unknownFields(value);
      if (bad.length) {
        return fail([{ path: `${k}_${part}`, message: `{${bad[0]}} isn't a field we can fill in. Use one from the list.` }]);
      }
    }
    messages[k] = { enabled: input[`${k}_enabled`] === "on", subject: subject.data, body: body.data };
  }
  if (messages.review_request.enabled && !v.review_url) {
    return fail([{ path: "review_url", message: "Add your review link to send review requests." }]);
  }

  return {
    success: true,
    data: {
      channels: { email: v.channel_email, sms: v.channel_sms },
      sender_name: v.sender_name || undefined,
      reply_to: v.reply_to ?? undefined,
      messages: {
        confirmation: messages.confirmation,
        reminder: { ...messages.reminder, hours_before: v.reminder_hours_before },
        follow_up: { ...messages.follow_up, days_after: v.follow_up_days_after },
        review_request: { ...messages.review_request, days_after: v.review_request_days_after, review_url: v.review_url ?? undefined },
      },
      alerts: {
        new_lead: v.alerts_new_lead,
        new_booking: v.alerts_new_booking,
        cancellation: v.alerts_cancellation,
        email: v.alerts_email ?? undefined,
      },
    },
  };
}

// ------------------------------------------------------------- AI assistant

export const assistantFormSchema = z
  .object({
    enabled: checkbox,
    mode: z.enum(Object.keys(ASSISTANT_MODES) as [AssistantMode, ...AssistantMode[]], "Pick what it handles."),
    tone: z.enum(Object.keys(ASSISTANT_TONES) as [AssistantTone, ...AssistantTone[]], "Pick a tone."),
    sign_off: text(60, "the sign-off"),
    follow_up_enabled: checkbox,
    first_after_hours: whole("The first follow-up", 1, 168),
    gap_days: whole("The gap between follow-ups", 1, 14),
    max_attempts: whole("Follow-ups", 1, 5),
    handoff_over_price: pounds("a price"),
    handoff_low_confidence: checkbox,
    handoff_keywords: text(600, "the words"),
    max_quote: pounds("a price"),
  })
  .transform((v, ctx): AssistantSettings => {
    const keywords = [
      ...new Set(
        v.handoff_keywords
          .split(/[,\n]/)
          .map((w) => w.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
    if (keywords.length > 20) {
      ctx.addIssue({ code: "custom", path: ["handoff_keywords"], message: "Up to 20 words or phrases." });
      return z.NEVER;
    }
    if (keywords.some((w) => w.length > 40)) {
      ctx.addIssue({ code: "custom", path: ["handoff_keywords"], message: "Keep each word or phrase under 40 characters." });
      return z.NEVER;
    }
    return {
      enabled: v.enabled,
      mode: v.mode,
      tone: v.tone,
      sign_off: v.sign_off || undefined,
      follow_up: {
        enabled: v.follow_up_enabled,
        first_after_hours: v.first_after_hours,
        gap_days: v.gap_days,
        max_attempts: v.max_attempts,
      },
      handoff: {
        over_price_pence: v.handoff_over_price,
        low_confidence: v.handoff_low_confidence,
        asks_for_human: true,
        keywords,
      },
      max_quote_pence: v.max_quote,
    };
  });

// ------------------------------------------------------------------ Privacy

// The booking page's marketing tick box, unless the business writes its own.
export const DEFAULT_MARKETING_CONSENT =
  "Email me reminders when the car's due another clean, and occasional offers. You can unsubscribe at any time.";

export const privacyExtrasFormSchema = z.object({
  privacy_policy_url: optionalUrl,
  marketing_consent_text: z
    .string()
    .trim()
    .refine((v) => v === "" || (v.length >= 10 && v.length <= 500), "Write between 10 and 500 characters, or leave it blank for ours.")
    .transform((v) => v || null),
  photo_retention_days: z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) >= 7 && Number(v) <= 3650), "Enter a number of days from 7 to 3650, or leave it blank.")
    .transform((v) => (v === "" ? null : Number(v))),
});

// ------------------------------------------------------------------ Account

export const profileFormSchema = z
  .object({
    full_name: z.string().trim().min(1, "Enter your name.").max(100, "Keep your name under 100 characters."),
    phone: z.string().trim().default(""),
  })
  .transform((v, ctx) => {
    if (!v.phone) return { full_name: v.full_name, phone: null };
    const phone = normalizePhone(v.phone);
    if (!phone) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter a valid phone number." });
      return z.NEVER;
    }
    return { full_name: v.full_name, phone };
  });
