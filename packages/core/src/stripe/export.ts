import "server-only";
import { offlinePaymentsBetween } from "../booking/offline-payments";
import { penceToPounds, toCsv } from "../csv";
import { getTenantPayments } from "./accounts";
import { getStripe } from "./client";
import { toPaymentRow, type ChargeLike, type PaymentRow } from "./payment-rules";

// Every payment in a period as a spreadsheet for an accountant: card payments
// from the business's Stripe account, plus cash and bank transfers recorded on
// bookings. Failed attempts are left out: no money moved.

const MAX_CHARGES = 10_000;

const SOURCE: Record<string, string> = {
  deposit: "Deposit (card)",
  payment_link: "Payment link (card)",
  other: "Other card payment",
  cash: "Cash",
  bank_transfer: "Bank transfer",
};

export function paymentsCsv(rows: PaymentRow[], timeZone: string) {
  const date = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone });
  return toCsv(
    ["Date", "Type", "Status", "Customer", "Description", "Gross", "Refunded", "Stripe fee", "Net", "Booking", "Note"],
    [...rows]
      .filter((p) => p.status !== "failed")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((p) => [
        date.format(new Date(p.createdAt)),
        SOURCE[p.source] ?? p.source,
        p.status,
        p.customerName,
        p.description,
        penceToPounds(p.amountPence),
        penceToPounds(p.refundedPence),
        p.feePence === null ? "" : penceToPounds(p.feePence),
        p.netPence === null ? "" : penceToPounds(p.netPence),
        p.bookingId?.slice(0, 8).toUpperCase(),
        p.note,
      ]),
  );
}

export async function exportPayments(tenantId: string, from: Date, to: Date, timeZone: string) {
  const { accountId } = await getTenantPayments(tenantId);
  const rows: PaymentRow[] = await offlinePaymentsBetween(tenantId, from, to);
  let truncated = false;
  if (accountId) {
    const list = getStripe().charges.list(
      { created: { gte: Math.floor(from.getTime() / 1000), lt: Math.ceil(to.getTime() / 1000) }, limit: 100, expand: ["data.balance_transaction"] },
      { stripeAccount: accountId },
    );
    let read = 0;
    for await (const charge of list) {
      if (++read > MAX_CHARGES) {
        truncated = true;
        break;
      }
      rows.push(toPaymentRow(charge as unknown as ChargeLike));
    }
  }
  return { csv: paymentsCsv(rows, timeZone), truncated };
}
