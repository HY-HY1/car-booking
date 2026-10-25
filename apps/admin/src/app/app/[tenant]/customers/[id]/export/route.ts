import { exportCustomerData } from "@leadgen/core/privacy/data";
import { requireTenant } from "@/lib/auth";

// GET /dashboard/<tenant>/customers/<id>/export: everything held about one
// customer as a JSON download, for a subject access request. Owner-only. The
// tenant comes from the signed-in session, not the URL's customer id.
export async function GET(
  _request: Request,
  { params }: RouteContext<"/app/[tenant]/customers/[id]/export">,
) {
  const { tenant: slug, id } = await params;
  const { tenant, can } = await requireTenant(slug);
  if (!can("customers.delete")) return new Response("Your access level doesn't include exporting customer data.", { status: 403 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });

  const data = await exportCustomerData(tenant.id, id);
  if (!data) return new Response("Not found", { status: 404 });

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="customer-${id}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
