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
  review_link: "Your review link",
} as const;
export type TemplateField = keyof typeof TEMPLATE_FIELDS;

export const CUSTOMER_MESSAGES = {
  confirmation: { label: "Booking confirmation", when: "Sent as soon as a booking is confirmed." },
  reminder: { label: "Reminder", when: "Sent before the appointment." },
  follow_up: { label: "Aftercare follow-up", when: "Sent after the job is marked complete." },
  review_request: { label: "Review request", when: "Sent after the job is marked complete." },
} as const;
export type CustomerMessage = keyof typeof CUSTOMER_MESSAGES;

const DEFAULT_TEMPLATES: Record<CustomerMessage, { subject: string; body: string }> = {
  confirmation: {
    subject: "You're booked in with {business_name}",
    body: "Hi {customer_name},\n\nThanks for booking {service} with {business_name}. We'll see you on {date} at {time}.\n\nWhere: {address}\n\nIf anything changes, just reply to this email.",
  },
  reminder: {
    subject: "See you soon: {service} on {date}",
    body: "Hi {customer_name},\n\nA quick reminder that we're booked in for {service} on {date} at {time}.\n\nWhere: {address}\n\nReply to this email if you need to change anything.",
  },
  follow_up: {
    subject: "Looking after your car after its {service}",
    body: "Hi {customer_name},\n\nThanks for choosing {business_name}. To keep the finish looking its best, wash with a pH-neutral shampoo and avoid automatic car washes.\n\nWhen it's due another clean, you can book again here: {booking_link}",
  },
  review_request: {
    subject: "How did we do?",
    body: "Hi {customer_name},\n\nThanks again for booking {service}. If you were happy with the job, a quick review would really help a small business like ours: {review_link}",
  },
};

const templateSchema = (key: CustomerMessage) => ({
  enabled: z.boolean().default(true).catch(true),
  subject: z.string().trim().min(1).max(150).default(DEFAULT_TEMPLATES[key].subject).catch(DEFAULT_TEMPLATES[key].subject),
  body: z.string().trim().min(1).max(3000).default(DEFAULT_TEMPLATES[key].body).catch(DEFAULT_TEMPLATES[key].body),
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
  review_link: "https://g.page/r/example/review",
};
