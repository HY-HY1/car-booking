import { z } from "zod";
import { formatPence } from "../booking/config";

// The cancellation and refund policy (Settings → Booking and → Payments),
// stored as booking_settings.cancellation_policy. {} means the business
// hasn't set one: nothing is promised to customers and refunds are the
// owner's call. No database access, so it can be tested.

export const lateFeeSchema = z.discriminatedUnion("type", [
  // Cancelled late or a no-show: the whole deposit is kept.
  z.object({ type: z.literal("deposit") }),
  // Kept up to this much; the rest of the deposit goes back.
  z.object({ type: z.literal("fixed"), value_pence: z.number().int().min(0) }),
  // Refunded in full even when late.
  z.object({ type: z.literal("none") }),
]);
export type LateFee = z.infer<typeof lateFeeSchema>;

export const cancellationPolicySchema = z.object({
  // Free to cancel up to this many hours before the start.
  cutoff_hours: z.number().int().min(0).max(720),
  // Free to move the time up to this many hours before.
  reschedule_cutoff_hours: z.number().int().min(0).max(720),
  // Cancelled in time: the deposit back in full, or never refundable.
  refund_before_cutoff: z.enum(["full", "none"]),
  late_fee: lateFeeSchema,
  // Anything else the owner wants customers to know.
  note: z.string().trim().max(500).optional(),
});
export type CancellationPolicy = z.infer<typeof cancellationPolicySchema>;

export const DEFAULT_POLICY: CancellationPolicy = {
  cutoff_hours: 24,
  reschedule_cutoff_hours: 24,
  refund_before_cutoff: "full",
  late_fee: { type: "deposit" },
};

// The stored json, or null when no policy has been set (or it's unreadable).
export function policyOf(raw: unknown): CancellationPolicy | null {
  const parsed = cancellationPolicySchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function formatNotice(hours: number) {
  if (hours === 0) return "any time before";
  if (hours >= 48 && hours % 24 === 0) return `${hours / 24} days before`;
  return `${hours} ${hours === 1 ? "hour" : "hours"} before`;
}

// What customers are told on the booking page, a sentence per line.
export function policyLines(policy: CancellationPolicy, takesDeposit: boolean): string[] {
  const lines: string[] = [];
  const cancel = formatNotice(policy.cutoff_hours);
  const move = formatNotice(policy.reschedule_cutoff_hours);

  if (policy.cutoff_hours === policy.reschedule_cutoff_hours) {
    lines.push(`You can cancel or change your booking up to ${cancel} the appointment.`);
  } else {
    lines.push(`You can cancel up to ${cancel} the appointment, and change the time up to ${move}.`);
  }

  if (takesDeposit) {
    if (policy.refund_before_cutoff === "none") {
      lines.push("Deposits aren't refundable.");
    } else {
      lines.push(`Cancel in time and your deposit is refunded in full.`);
      const fee = policy.late_fee;
      lines.push(
        fee.type === "deposit"
          ? "Cancel later than that, or miss the appointment, and the deposit is kept."
          : fee.type === "fixed"
            ? `Cancel later than that, or miss the appointment, and ${formatPence(fee.value_pence)} of the deposit is kept.`
            : "Your deposit is refunded even if you cancel late.",
      );
    }
  }
  if (policy.note) lines.push(policy.note);
  return lines;
}

export type RefundAdvice = {
  // What the policy says to give back, in pence.
  refundPence: number;
  kind: "full" | "partial" | "none";
  // One line for the owner: why.
  reason: string;
};

// What the policy says to refund when a booking is cancelled at `at`.
// Null when there's no policy or nothing was paid: the owner decides.
export function refundAdvice(
  policy: CancellationPolicy | null,
  booking: { startsAt: string | Date; depositPaidPence: number },
  at: Date = new Date(),
): RefundAdvice | null {
  if (!policy || booking.depositPaidPence <= 0) return null;
  const paid = booking.depositPaidPence;
  const hoursBefore = (new Date(booking.startsAt).getTime() - at.getTime()) / 3_600_000;
  const inTime = hoursBefore >= policy.cutoff_hours;
  const notice = formatNotice(policy.cutoff_hours);

  if (inTime) {
    return policy.refund_before_cutoff === "full"
      ? { refundPence: paid, kind: "full", reason: `Cancelled more than ${notice} the start: your policy refunds the deposit in full.` }
      : { refundPence: 0, kind: "none", reason: "Your policy says deposits aren't refundable." };
  }

  const fee = policy.late_fee;
  if (policy.refund_before_cutoff === "none") {
    return { refundPence: 0, kind: "none", reason: "Your policy says deposits aren't refundable." };
  }
  if (fee.type === "none") {
    return { refundPence: paid, kind: "full", reason: "Cancelled late, but your policy refunds the deposit anyway." };
  }
  if (fee.type === "deposit") {
    return { refundPence: 0, kind: "none", reason: `Cancelled less than ${notice} the start: your policy keeps the deposit.` };
  }
  const refund = Math.max(0, paid - fee.value_pence);
  return {
    refundPence: refund,
    kind: refund === 0 ? "none" : refund === paid ? "full" : "partial",
    reason: `Cancelled less than ${notice} the start: your policy keeps ${formatPence(Math.min(fee.value_pence, paid))} of the deposit.`,
  };
}
