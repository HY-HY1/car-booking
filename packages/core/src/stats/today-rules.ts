import { paymentSummary } from "../stripe/payment-rules";

// What's still owed on finished jobs. Paid so far comes from the payments
// ledger, which holds card, cash and bank payments alike; the booking's own
// deposit is the floor, as everywhere else. Longest-waiting first.
export function balancesDue<T extends { id: string; ends_at: string; price_pence: number; deposit_pence: number; deposit_status: string }>(
  jobs: T[],
  paid: Map<string, number>,
) {
  return jobs
    .map((job) => ({
      job,
      balancePence: paymentSummary(job, [{ status: "paid", amountPence: paid.get(job.id) ?? 0, refundedPence: 0 }]).balancePence,
    }))
    .filter((j) => j.balancePence > 0)
    .sort((a, b) => a.job.ends_at.localeCompare(b.job.ends_at));
}
