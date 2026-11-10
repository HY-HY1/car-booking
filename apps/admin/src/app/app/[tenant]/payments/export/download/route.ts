import { isIsoDate, addDays, zonedTimeToUtc } from "@leadgen/core/booking/time";
import { exportPayments } from "@leadgen/core/stripe/export";
import { logActivity } from "@/lib/activity";
import { requireTenant } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// GET .../payments/export/download?from=YYYY-MM-DD&to=YYYY-MM-DD: every payment in those
// days, inclusive, as a spreadsheet for the accountant.
export async function GET(request: Request, { params }: RouteContext<"/app/[tenant]/payments/export/download">) {
  const { tenant: slug } = await params;
  const { tenant, can } = await requireTenant(slug);
  if (!can("money")) return new Response("Your access level doesn't include payments.", { status: 403 });

  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  if (!isIsoDate(from) || !isIsoDate(to) || to < from) return new Response("Pick a start date and an end date.", { status: 400 });

  const supabase = await createClient();
  const settings = await supabase.from("booking_settings").select("timezone").eq("tenant_id", tenant.id).maybeSingle();
  if (settings.error) throw settings.error;
  const timeZone = settings.data?.timezone ?? "Europe/London";

  const { csv } = await exportPayments(tenant.id, zonedTimeToUtc(from, "00:00", timeZone), zonedTimeToUtc(addDays(to, 1), "00:00", timeZone), timeZone);
  await logActivity(tenant.id, "payment.exported", `Exported payments from ${from} to ${to}`);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="payments-${from}-to-${to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
