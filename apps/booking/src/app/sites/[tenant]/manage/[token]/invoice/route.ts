import { bookingIdFromToken } from "@leadgen/core/booking/manage";
import { loadInvoice } from "@leadgen/core/invoice/load";
import { invoiceHtml } from "@leadgen/core/invoice/render";
import { requireRequestTenant } from "@/lib/tenant";

// The customer's own invoice, from the signed link in their booking emails.
export async function GET(_request: Request, { params }: RouteContext<"/sites/[tenant]/manage/[token]/invoice">) {
  const tenant = await requireRequestTenant();
  const { token } = await params;
  const bookingId = await bookingIdFromToken(tenant.id, token);
  if (!bookingId) return new Response("That link isn't working.", { status: 404 });

  const invoice = await loadInvoice(tenant.id, bookingId);
  if (!invoice) return new Response("There's no invoice for this booking yet.", { status: 404 });
  return new Response(invoiceHtml(invoice), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}
