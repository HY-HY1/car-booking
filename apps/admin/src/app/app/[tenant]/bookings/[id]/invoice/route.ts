import { loadInvoice } from "@leadgen/core/invoice/load";
import { invoiceHtml } from "@leadgen/core/invoice/render";
import { requireTenant } from "@/lib/auth";

// The customer's invoice for a booking, to print or save as a PDF. For whoever
// handles money; the business comes from the signed-in session.
export async function GET(_request: Request, { params }: RouteContext<"/app/[tenant]/bookings/[id]/invoice">) {
  const { tenant: slug, id } = await params;
  const { tenant, can } = await requireTenant(slug);
  if (!can("money")) return new Response("Your access level doesn't include invoices.", { status: 403 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });

  const invoice = await loadInvoice(tenant.id, id);
  if (!invoice) return new Response("There's nothing to invoice on this booking yet.", { status: 404 });
  return new Response(invoiceHtml(invoice), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
