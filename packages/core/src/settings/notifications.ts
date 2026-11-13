import { z } from "zod";

// Messages to customers and alerts to the owner (Settings → Notifications),
// stored as tenants.notification_settings and read by email/notify.ts when it
// sends, so every field has a default and an unreadable value falls back to
// it rather than stopping a message. No database access.

export const TEMPLATE_FIELDS = {
  customer_name: "Customer's first name",
  business_name: "Your business name",
  service: "The service booked",
  date: "Day and date, e.g. Friday 24 October",
  time: "Start time, e.g. 9:30am",
  address: "Where the job is",
  booking_link: "Link to the booking page",
  manage_link: "The customer's link to change or cancel this booking (confirmation, reminder and earlier-time messages only)",
  review_link: "Your review link",
} as const;
export type TemplateField = keyof typeof TEMPLATE_FIELDS;

export const CUSTOMER_MESSAGES = {
  confirmation: { label: "Booking confirmation", when: "Sent as soon as a booking is confirmed." },
  reminder: { label: "Reminder", when: "Sent before the appointment." },
  follow_up: { label: "Aftercare follow-up", when: "Sent after the job is marked complete." },
  review_request: { label: "Review request", when: "Sent after the job is marked complete." },
  quote_follow_up: { label: "Quote follow-up", when: "Sent to someone who got a price but didn't book." },
  rebook_reminder: { label: "Time to book again", when: "Sent when a service is due again (set the weeks on each service)." },
  slot_opened: { label: "An earlier time has opened up", when: "Sent to customers who said they're flexible, when a job is cancelled." },
} as const;
export type CustomerMessage = keyof typeof CUSTOMER_MESSAGES;

// The booking's details (service, date, time, address, price) and the button
// (manage, book again, review) are added around these by the email layout
// (email/compose.ts templateMessage), so the wording doesn't repeat them.
const DEFAULT_TEMPLATES: Record<CustomerMessage, { subject: string; body: string }> = {
  confirmation: {
    subject: "You're booked in with {business_name}",
    body: "Hi {customer_name},\n\nThanks for booking {service} with {business_name}. We'll see you on {date} at {time}.\n\nIf anything changes, use the button below or just reply to this email.",
  },
  reminder: {
    subject: "See you soon: {service} on {date}",
    body: "Hi {customer_name},\n\nA quick reminder that we're booked in for {service} on {date} at {time}.\n\nReply to this email if you need to change anything.",
  },
  follow_up: {
    subject: "Looking after your car after its {service}",
    body: "Hi {customer_name},\n\nThanks for choosing {business_name}. To keep the finish looking its best, wash with a pH-neutral shampoo and avoid automatic car washes.\n\nWhen it's due another clean, you can book again with the button below.",
  },
  review_request: {
    subject: "How did we do?",
    body: "Hi {customer_name},\n\nThanks again for booking {service}. If you were happy with the job, a quick review would really help a small business like ours.",
  },
  quote_follow_up: {
    subject: "Still thinking about your {service}?",
    body: "Hi {customer_name},\n\nThanks for getting a price from {business_name}. If you'd like to go ahead, you can pick a time with the button below.\n\nAny questions, just reply to this email.",
  },
  rebook_reminder: {
    subject: "Time for another {service}?",
    body: "Hi {customer_name},\n\nIt's about time your car had another {service}. You can pick a time that suits you with the button below.",
  },
  slot_opened: {
    subject: "An earlier time has opened up",
    body: "Hi {customer_name},\n\nYou said you'd like to know if an earlier time came up for your {service}. We now have {date} at {time}.\n\nIf that suits you, move your booking with the button below while it's still free. Otherwise you don't need to do anything, and your booking stays as it is.",
  },
};

// Our earlier wording, from before the layout carried the details and the
// button. A business that saved its settings without changing a message
// stored this text; it's read as today's wording so their emails don't
// repeat the address or show a bare link above the button.
const LEGACY_BODIES: Partial<Record<CustomerMessage, string[]>> = {
  confirmation: [
    "Hi {customer_name},\n\nThanks for booking {service} with {business_name}. We'll see you on {date} at {time}.\n\nWhere: {address}\n\nIf anything changes, just reply to this email.",
  ],
  reminder: [
    "Hi {customer_name},\n\nA quick reminder that we're booked in for {service} on {date} at {time}.\n\nWhere: {address}\n\nReply to this email if you need to change anything.",
  ],
  follow_up: [
    "Hi {customer_name},\n\nThanks for choosing {business_name}. To keep the finish looking its best, wash with a pH-neutral shampoo and avoid automatic car washes.\n\nWhen it's due another clean, you can book again here: {booking_link}",
  ],
  review_request: [
    "Hi {customer_name},\n\nThanks again for booking {service}. If you were happy with the job, a quick review would really help a small business like ours: {review_link}",
  ],
  quote_follow_up: [
    "Hi {customer_name},\n\nThanks for getting a price from {business_name}. If you'd like to go ahead, you can pick a time here: {booking_link}\n\nAny questions, just reply to this email.",
  ],
  rebook_reminder: ["Hi {customer_name},\n\nIt's about time your car had another {service}. You can pick a time that suits you here: {booking_link}"],
  slot_opened: [
    "Hi {customer_name},\n\nYou said you'd like to know if an earlier time came up for your {service}. We now have {date} at {time}.\n\nIf that suits you, move your booking here while it's still free: {manage_link}\n\nOtherwise you don't need to do anything, and your booking stays as it is.",
  ],
};

// Line endings are compared loosely: a textarea sends \r\n.
const sameText = (a: string, b: string) => a.replace(/\r\n/g, "\n").trim() === b.replace(/\r\n/g, "\n").trim();

export function upgradeLegacyBody(key: CustomerMessage, body: string) {
  return LEGACY_BODIES[key]?.some((old) => sameText(old, body)) ? DEFAULT_TEMPLATES[key].body : body;
}

const templateSchema = (key: CustomerMessage) => ({
  enabled: z.boolean().default(true).catch(true),
  subject: z.string().trim().min(1).max(150).default(DEFAULT_TEMPLATES[key].subject).catch(DEFAULT_TEMPLATES[key].subject),
  body: z
    .string()
    .trim()
    .min(1)
    .max(3000)
    .default(DEFAULT_TEMPLATES[key].body)
    .catch(DEFAULT_TEMPLATES[key].body)
    .transform((body) => upgradeLegacyBody(key, body)),
});

const optionalEmail = z.email().optional().catch(undefined);

export const notificationSettingsSchema = z.object({
  channels: z
    .object({
      email: z.boolean().default(true).catch(true),
      sms: z.boolean().default(false).catch(false),
    })
    .prefault({}),
  // The "from" name customers see, e.g. "Shine Detailing". Default: the business name.
  sender_name: z.string().trim().min(1).max(60).optional().catch(undefined),
  // Replies go here. Default: the business's contact email.
  reply_to: optionalEmail,
  messages: z
    .object({
      confirmation: z.object(templateSchema("confirmation")).prefault({}),
      reminder: z
        .object({ ...templateSchema("reminder"), hours_before: z.number().int().min(1).max(168).default(24).catch(24) })
        .prefault({}),
      follow_up: z
        .object({
          ...templateSchema("follow_up"),
          enabled: z.boolean().default(false).catch(false),
          days_after: z.number().int().min(1).max(60).default(3).catch(3),
        })
        .prefault({}),
      review_request: z
        .object({
          ...templateSchema("review_request"),
          enabled: z.boolean().default(false).catch(false),
          days_after: z.number().int().min(0).max(30).default(1).catch(1),
          review_url: z.url().optional().catch(undefined),
        })
        .prefault({}),
      // These reach customers without anyone pressing a button, so each is
      // off until the business chooses to send it.
      quote_follow_up: z
        .object({
          ...templateSchema("quote_follow_up"),
          enabled: z.boolean().default(false).catch(false),
          days_after: z.number().int().min(1).max(30).default(2).catch(2),
        })
        .prefault({}),
      rebook_reminder: z.object({ ...templateSchema("rebook_reminder"), enabled: z.boolean().default(false).catch(false) }).prefault({}),
      slot_opened: z.object({ ...templateSchema("slot_opened"), enabled: z.boolean().default(false).catch(false) }).prefault({}),
    })
    .prefault({}),
  // Alerts to the owner.
  alerts: z
    .object({
      new_lead: z.boolean().default(true).catch(true),
      new_booking: z.boolean().default(true).catch(true),
      cancellation: z.boolean().default(true).catch(true),
      // Where they go. Default: the owner's login email.
      email: optionalEmail,
    })
    .prefault({}),
});
export type NotificationSettings = z.infer<typeof notificationSettingsSchema>;

export function notificationsOf(raw: unknown): NotificationSettings {
  const parsed = notificationSettingsSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : notificationSettingsSchema.parse({});
}

export function defaultTemplate(key: CustomerMessage) {
  return DEFAULT_TEMPLATES[key];
}

// {customer_name} → the value. Unknown or missing fields are left blank, so a
// typo in a template never sends "{custmer_name}" to a customer.
export function renderTemplate(text: string, values: Partial<Record<TemplateField, string>>) {
  return text.replace(/\{([a-z_]+)\}/g, (_, key: string) => values[key as TemplateField] ?? "");
}

// Placeholders a template uses that aren't real fields, to warn the owner.
export function unknownFields(text: string): string[] {
  const found = [...text.matchAll(/\{([a-z_]+)\}/g)].map((m) => m[1]);
  return [...new Set(found.filter((f) => !(f in TEMPLATE_FIELDS)))];
}

// Example values for previews in Settings.
export const SAMPLE_VALUES: Record<TemplateField, string> = {
  customer_name: "Sam",
  business_name: "",
  service: "Full valet",
  date: "Friday 24 October",
  time: "9:30am",
  address: "12 High Street, BS1 4DJ",
  booking_link: "https://book.example.co.uk",
  manage_link: "https://book.example.co.uk/manage/…",
  review_link: "https://g.page/r/example/review",
};
