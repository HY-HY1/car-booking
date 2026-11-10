import "server-only";
import { bookingReference } from "../booking/confirmation";
import { PAYABLE_BOOKING_STATUSES, paymentSummary } from "../stripe/payment-rules";
import { loadBookingPayments } from "../stripe/ledger";
import { createAdminClient } from "../supabase/admin";
import type { Invoice } from "./render";

// The invoice for a booking, numbering it the first time it's opened. Null
// for a booking that can't be billed. The caller has checked who is asking.
export async function loadInvoice(tenantId: string, bookingId: string): Promise<Invoice | null> {
  const db = createAdminClient();
  const [bookingResult, tenantResult, settingsResult] = await Promise.all([
    db
      .from("bookings")
      .select("id, status, starts_at, created_at, price_pence, deposit_pence, deposit_status, address_line, postcode, quote_snapshot, service:services(name), customer:customers(name)")
      .eq("tenant_id", tenantId)
      .eq("id", bookingId)
      .maybeSingle(),
    db.from("tenants").select("name, legal_name, contact_email, contact_phone, vat_number").eq("id", tenantId).single(),
    db.from("booking_settings").select("timezone").eq("tenant_id", tenantId).maybeSingle(),
  ]);
  if (bookingResult.error) throw bookingResult.error;
  if (tenantResult.error) throw tenantResult.error;
  if (settingsResult.error) throw settingsResult.error;
  const b = bookingResult.data;
  if (!b || !(PAYABLE_BOOKING_STATUSES as readonly string[]).includes(b.status)) return null;

  const numbered = await db.rpc("assign_invoice_number", { p_tenant: tenantId, p_booking: bookingId });
  if (numbered.error) throw numbered.error;
  if (numbered.data === null) return null;

  // Stamped when it was first numbered, so the date on it never changes.
  const stamped = await db.from("bookings").select("invoiced_at").eq("tenant_id", tenantId).eq("id", bookingId).single();
  if (stamped.error) throw stamped.error;

  const { paidPence } = paymentSummary(b, await loadBookingPayments(tenantId, b.id));
  const snapshot = b.quote_snapshot as { lines?: { label: string; amount_pence: number }[] } | null;
  const service = (b.service as unknown as { name: string } | null)?.name ?? "Booking";
  const customer = (b.customer as unknown as { name: string } | null)?.name ?? "Customer";
  const t = tenantResult.data;

  return {
    number: numbered.data as number,
    reference: bookingReference(b.id),
    issuedAt: stamped.data.invoiced_at,
    jobDate: b.starts_at,
    timeZone: settingsResult.data?.timezone ?? "Europe/London",
    business: { name: t.name, legalName: t.legal_name, email: t.contact_email, phone: t.contact_phone, vatNumber: t.vat_number },
    customer: { name: customer, address: [b.address_line, b.postcode].filter(Boolean).join(", ") || null },
    lines: snapshot?.lines?.length ? snapshot.lines : [{ label: service, amount_pence: b.price_pence }],
    totalPence: b.price_pence,
    paidPence,
  };
}
