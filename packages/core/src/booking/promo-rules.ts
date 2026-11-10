import { z } from "zod";
import type { DepositRule } from "./config";
import { depositFor, type Quote } from "./pricing";

// Discount and voucher codes, with no database access so the booking form's
// preview and the server's final price agree. Codes are entered in any case.

export type Promo = { id: string; code: string; kind: "percent" | "fixed"; value: number };

export const normaliseCode = (code: string) => code.trim().toUpperCase();

export function discountPence(totalPence: number, promo: Pick<Promo, "kind" | "value">) {
  const off = promo.kind === "percent" ? Math.round((totalPence * promo.value) / 100) : promo.value;
  return Math.min(Math.max(off, 0), totalPence);
}

// The discount comes off last, after any minimum charge, and the deposit is
// worked out on what they'll actually pay.
export function applyPromo(quote: Quote, promo: Promo, deposit: DepositRule): Quote {
  const off = discountPence(quote.total_pence, promo);
  if (off === 0) return quote;
  const total = quote.total_pence - off;
  return {
    ...quote,
    lines: [...quote.lines, { label: `Discount (${promo.code})`, amount_pence: -off }],
    total_pence: total,
    deposit_pence: depositFor(total, deposit),
  };
}

// Why a code can't be used now, or null if it can.
export function promoProblem(row: { active: boolean; expires_at: string | null; max_uses: number | null }, uses: number, now: Date) {
  if (!row.active) return "That code isn't active.";
  if (row.expires_at && new Date(row.expires_at).getTime() <= now.getTime()) return "That code has expired.";
  if (row.max_uses !== null && uses >= row.max_uses) return "That code has been used up.";
  return null;
}

// Settings form. Values arrive as strings, from a browser.
export const promoFormSchema = z
  .object({
    code: z
      .string()
      .transform(normaliseCode)
      .refine((v) => /^[A-Z0-9-]{2,30}$/.test(v), "Use 2 to 30 letters, numbers or hyphens."),
    kind: z.enum(["percent", "fixed"], "Pick the kind of discount."),
    amount: z.string().trim(),
    max_uses: z.string().trim().default(""),
    expires_on: z.string().trim().default(""),
  })
  .transform((v, ctx) => {
    const problem = (path: string, message: string) => {
      ctx.addIssue({ code: "custom", path: [path], message });
      return z.NEVER;
    };
    const amount = Number(v.amount.replace(/^£/, ""));
    if (!Number.isFinite(amount) || amount <= 0) return problem("amount", "Enter how much it takes off.");
    if (v.kind === "percent" && (!Number.isInteger(amount) || amount > 100)) return problem("amount", "Enter a whole percentage from 1 to 100.");
    const maxUses = v.max_uses === "" ? null : Number(v.max_uses);
    if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses <= 0)) return problem("max_uses", "Enter a whole number, or leave it blank for no limit.");
    if (v.expires_on && !/^\d{4}-\d{2}-\d{2}$/.test(v.expires_on)) return problem("expires_on", "Pick a date, or leave it blank.");
    return {
      code: v.code,
      kind: v.kind,
      value: v.kind === "percent" ? amount : Math.round(amount * 100),
      max_uses: maxUses,
      // The end of that day, UK time near enough for a promo code.
      expires_at: v.expires_on ? `${v.expires_on}T23:59:59Z` : null,
    };
  });
