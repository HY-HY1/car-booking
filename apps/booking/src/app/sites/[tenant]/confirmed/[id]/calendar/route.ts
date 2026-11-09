import { icsFile } from "@leadgen/core/booking/confirmation";
import { getBookingSummary } from "@leadgen/core/booking/engine";
import { requireRequestTenant } from "@/lib/tenant";
import { calendarEntry } from "../booked";

// "Add to calendar" for anything but Google: a file the phone or computer
// opens in its own calendar. Only a confirmed booking has one.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = await requireRequestTenant();
  const { id } = await params;
  const booking = await getBookingSummary(tenant.id, id);
  if (booking?.status !== "confirmed") return new Response("Not found", { status: 404 });

  return new Response(icsFile(calendarEntry(id, booking, tenant.name, tenant.contact)), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'attachment; filename="booking.ics"',
      "cache-control": "no-store",
    },
  });
}
