import { z } from "zod";

// How the AI booking assistant behaves (Settings → AI assistant), stored as
// tenants.agent_rules. The assistant isn't built yet; this is what it will
// read. Every field has a default, and an unreadable value falls back to it.

export const ASSISTANT_MODES = {
  qualify: { label: "Qualify only", detail: "Asks the questions and collects photos, then hands the lead to you." },
  quote: { label: "Qualify and quote", detail: "Gives the customer a price from your price list. You book them in." },
  book: { label: "Quote and book", detail: "Prices the job and books it into your diary, deposit and all." },
} as const;
export type AssistantMode = keyof typeof ASSISTANT_MODES;

export const ASSISTANT_TONES = {
  friendly: "Friendly and relaxed",
  professional: "Professional and to the point",
} as const;
export type AssistantTone = keyof typeof ASSISTANT_TONES;

export const assistantSettingsSchema = z.object({
  enabled: z.boolean().default(false).catch(false),
  mode: z.enum(Object.keys(ASSISTANT_MODES) as [AssistantMode, ...AssistantMode[]]).default("quote").catch("quote"),
  tone: z.enum(Object.keys(ASSISTANT_TONES) as [AssistantTone, ...AssistantTone[]]).default("friendly").catch("friendly"),
  // How it signs off, e.g. "Jack at Shine Detailing". Default: the business name.
  sign_off: z.string().trim().min(1).max(60).optional().catch(undefined),
  follow_up: z
    .object({
      enabled: z.boolean().default(true).catch(true),
      // First nudge this long after they go quiet.
      first_after_hours: z.number().int().min(1).max(168).default(4).catch(4),
      // Then this many days apart...
      gap_days: z.number().int().min(1).max(14).default(2).catch(2),
      // ...at most this many times in all.
      max_attempts: z.number().int().min(1).max(5).default(3).catch(3),
    })
    .prefault({}),
  handoff: z
    .object({
      // Jobs over this price go to you; null = no limit.
      over_price_pence: z.number().int().min(0).nullable().default(null).catch(null),
      // It isn't sure of the size or condition from what it's been told.
      low_confidence: z.boolean().default(true).catch(true),
      // Always on: a customer who asks for a person gets one.
      asks_for_human: z.literal(true).default(true).catch(true),
      // Words in a message that send it to you, e.g. "complaint", "lease return".
      keywords: z.array(z.string().trim().min(1).max(40)).max(20).default([]).catch([]),
    })
    .prefault({}),
  // It won't quote more than this without your approval; null = no limit.
  max_quote_pence: z.number().int().min(0).nullable().default(null).catch(null),
});
export type AssistantSettings = z.infer<typeof assistantSettingsSchema>;

export function assistantOf(raw: unknown): AssistantSettings {
  const parsed = assistantSettingsSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : assistantSettingsSchema.parse({});
}
