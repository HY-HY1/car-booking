import { toCsv } from "@leadgen/core/csv";
import { logActivity } from "@/lib/activity";
import { requireTenant } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Every customer as a spreadsheet. The whole list is more sensitive than one
// record, so it's for the same people who can erase customers.
export async function GET(_request: Request, { params }: RouteContext<"/app/[tenant]/customers/export">) {
  const { tenant: slug } = await params;
  const { tenant, can } = await requireTenant(slug);
  if (!can("customers.delete")) return new Response("Your access level doesn't include exporting customers.", { status: 403 });

  const supabase = await createClient();
  const rows: (string | null)[][] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("customers")
      .select("name, email, phone, address_line, postcode, notes, source, email_marketing, created_at")
      .eq("tenant_id", tenant.id)
      .is("anonymised_at", null)
      .order("created_at")
      .order("id")
      .range(from, from + 999);
    if (error) throw error;
    for (const c of data) {
      rows.push([c.name, c.email, c.phone, c.address_line, c.postcode, c.notes, c.source, c.email_marketing ? "yes" : "no", c.created_at.slice(0, 10)]);
    }
    if (data.length < 1000) break;
  }

  await logActivity(tenant.id, "customer.exported", `Exported ${rows.length} customers`);
  return new Response(toCsv(["name", "email", "phone", "address", "postcode", "notes", "source", "email marketing", "added"], rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="customers.csv"',
      "Cache-Control": "no-store",
    },
  });
}
