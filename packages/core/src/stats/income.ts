import { toPaymentRow, type ChargeLike, type PaymentRow, type PaymentSource } from "../stripe/payment-rules";
import { bucketIndex, type PeriodRange } from "./periods";

// Turning a list of Stripe charges into the income figures the overview
// shows. No Stripe or database access here, so it's tested on its own.

export type IncomeTotals = {
  // Everything customers paid, before refunds.
  grossPence: number;
  refundedPence: number;
  // Gross less refunds: what the business has actually earned.
  incomePence: number;
  // Stripe's processing fees. Stripe keeps these even on refunded payments.
  feesPence: number;
  // Income less fees: what ends up in the bank.
  takeHomePence: number;
  payments: number;
};

const empty = (): IncomeTotals => ({ grossPence: 0, refundedPence: 0, incomePence: 0, feesPence: 0, takeHomePence: 0, payments: 0 });

function add(t: IncomeTotals, row: PaymentRow) {
  t.grossPence += row.amountPence;
  t.refundedPence += row.refundedPence;
  t.feesPence += row.feePence ?? 0;
  t.payments += 1;
  t.incomePence = t.grossPence - t.refundedPence;
  t.takeHomePence = t.incomePence - t.feesPence;
}

export type IncomeSummary = {
  current: IncomeTotals;
  previous: IncomeTotals;
  // Income per bucket of the current period, in step with range.buckets.
  perBucket: number[];
  bySource: Record<PaymentSource, number>;
  recent: PaymentRow[];
};

// Only payments that went through count: pending ones aren't money yet, and
// failed attempts never were. A charge is placed by when it was taken.
export function summariseIncome(charges: ChargeLike[], range: PeriodRange): IncomeSummary {
  const current = empty();
  const previous = empty();
  const perBucket = range.buckets.map(() => 0);
  const bySource: Record<PaymentSource, number> = { deposit: 0, payment_link: 0, other: 0 };
  const inCurrent: PaymentRow[] = [];

  for (const charge of charges) {
    if (charge.status !== "succeeded") continue;
    const row = toPaymentRow(charge);
    const at = new Date(row.createdAt);

    if (at >= range.start && at < range.end) {
      add(current, row);
      inCurrent.push(row);
      bySource[row.source] += row.amountPence - row.refundedPence;
      const i = bucketIndex(range.buckets, at);
      if (i >= 0) perBucket[i] += row.amountPence - row.refundedPence;
    } else if (at >= range.compareStart && at < range.compareEnd) {
      add(previous, row);
    }
  }

  inCurrent.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { current, previous, perBucket, bySource, recent: inCurrent.slice(0, 5) };
}
