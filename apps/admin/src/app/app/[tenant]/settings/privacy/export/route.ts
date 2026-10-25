import { exportBusinessData } from "@leadgen/core/settings/account";
import { requireTenant } from "@/lib/auth";

// GET /dashboard/<tenant>/settings/privacy/export: everything the business
// holds as one JSON download (settings, prices, customers, enquiries,
// bookings, privacy records). Owner-only.
export async function GET(_request: Request, { params }: RouteContext<"/app/[tenant]/settings/privacy/export">) {
  const { tenant: slug } = await params;
  const { tenant, can } = await requireTenant(slug);
  if (!can("data.export")) return new Response("Only the business owner can export the business's data.", { status: 403 });

  const data = await exportBusinessData(tenant.id);
  const day = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${tenant.slug}-export-${day}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
