import "server-only";
import { createAdminClient } from "../supabase/admin";
import { getTenantPayments } from "./accounts";
import { getStripe } from "./client";
import { toPaymentRow, type ChargeLike, type PaymentRow } from "./payment-rules";

// Every payment a business has taken, read live from their own Stripe account
// (not a copy), so it includes payments that never went through our booking
// flow. Each is matched to a booking where it came from one.

export type PaymentWithBooking = PaymentRow & {
  booking: { id: string; customerName: string | null; serviceName: string | null; startsAt: string } | null;
};

export type PaymentsPage =
  | { connected: false }
  | { connected: true; payments: PaymentWithBooking[]; nextCursor: string | null };

const PAGE_SIZE = 25;

export async function listPayments(tenantId: string, after?: string): Promise<PaymentsPage> {
  const { accountId } = await getTenantPayments(tenantId);
  if (!accountId) return { connected: false };

  const charges = await getStripe().charges.list(
    {
      limit: PAGE_SIZE,
      expand: ["data.balance_transaction"],
      ...(after && /^ch_[A-Za-z0-9]+$/.test(after) && { starting_after: after }),
    },
    { stripeAccount: accountId },
  );

  // Failed attempts aren't payments taken.
  const rows = charges.data.filter((c) => c.status !== "failed").map((c) => toPaymentRow(c as unknown as ChargeLike));

  // Booking details come from our own database, looked up within this
  // tenant only. The ids in Stripe metadata are only ever used as filters.
  const bookingIds = [...new Set(rows.flatMap((r) => (r.bookingId ? [r.bookingId] : [])))];
  const bookings = new Map<string, NonNullable<PaymentWithBooking["booking"]>>();
  if (bookingIds.length) {
    const { data, error } = await createAdminClient()
      .from("bookings")
      .select("id, starts_at, customer:customers(name), service:services(name)")
      .eq("tenant_id", tenantId)
      .in("id", bookingIds);
    if (error) throw error;
    for (const b of data) {
      bookings.set(b.id, {
        id: b.id,
        startsAt: b.starts_at,
        customerName: (b.customer as unknown as { name: string } | null)?.name ?? null,
        serviceName: (b.service as unknown as { name: string } | null)?.name ?? null,
      });
    }
  }

  return {
    connected: true,
    payments: rows.map((r) => ({ ...r, booking: r.bookingId ? (bookings.get(r.bookingId) ?? null) : null })),
    nextCursor: charges.has_more ? (charges.data.at(-1)?.id ?? null) : null,
  };
}
