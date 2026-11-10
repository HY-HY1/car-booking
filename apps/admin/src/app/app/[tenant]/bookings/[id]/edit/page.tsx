import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { formatPence, sizeClassSchema } from "@leadgen/core/booking/config";
import { canEditBooking, extraCarLabel } from "@leadgen/core/booking/edit-rules";
import { getBookingConfig } from "@leadgen/core/booking/engine";
import { RemoveExtraCar } from "@/components/dashboard/booking-extras";
import { EditBookingForm, ExtraCarForm } from "@/components/dashboard/edit-booking-form";
import { BackLink, PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/urls";
import { addExtraCarAction, editBookingAction, removeExtraCarAction } from "./actions";

export const metadata: Metadata = { title: "Change booking" };

export default async function EditBookingPage({ params }: PageProps<"/app/[tenant]/bookings/[id]/edit">) {
  const { tenant: slug, id } = await params;
  const { tenant } = await requireAccess(slug, "bookings.manage");
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const [bookingResult, carsResult, staffResult, resourcesResult, config] = await Promise.all([
    supabase
      .from("bookings")
      .select("status, starts_at, ends_at, location_type, address_line, postcode, resource_id, service_id, staff_id, price_pence, quote_snapshot, vehicle:vehicles(size_class)")
      .eq("tenant_id", tenant.id)
      .eq("id", id)
      .maybeSingle(),
    supabase.from("booking_vehicles").select("id, make, model, registration, price_pence, extra_mins").eq("tenant_id", tenant.id).eq("booking_id", id).order("created_at"),
    supabase.from("staff").select("id, name, active").eq("tenant_id", tenant.id).order("sort_order"),
    supabase.from("resources").select("id, name, active, location_types").eq("tenant_id", tenant.id).order("sort_order"),
    getBookingConfig(tenant.id),
  ]);
  if (bookingResult.error) throw bookingResult.error;
  if (carsResult.error) throw carsResult.error;
  if (staffResult.error) throw staffResult.error;
  if (resourcesResult.error) throw resourcesResult.error;
  const b = bookingResult.data;
  if (!b || !config) notFound();
  const back = appUrl(`/${slug}/bookings/${id}`);
  if (!canEditBooking(b.status)) redirect(back);

  const snapshot = b.quote_snapshot as { add_on_ids?: string[]; size_class?: string } | null;
  const vehicle = b.vehicle as unknown as { size_class: string | null } | null;
  const sizeClass = sizeClassSchema.safeParse(vehicle?.size_class ?? snapshot?.size_class).data ?? "medium";
  const minutes = Math.round((new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime()) / 60_000);

  return (
    <>
      <BackLink href={back}>Booking</BackLink>
      <PageHeader title="Change booking" description="To change the date or time, use Move on the job in the diary." />
      <div className="grid max-w-3xl gap-4">
        <Card>
          <CardContent>
            <EditBookingForm
              action={editBookingAction.bind(null, slug, id)}
              services={config.services}
              addOns={config.addOns}
              resources={resourcesResult.data
                .filter((r) => (r.active || r.id === b.resource_id) && (r.location_types as string[]).includes(b.location_type))
                .map((r) => ({ id: r.id, name: r.name }))}
              staff={staffResult.data.filter((s) => s.active || s.id === b.staff_id).map((s) => ({ id: s.id, name: s.name }))}
              locationType={b.location_type}
              values={{
                serviceId: b.service_id ?? config.services[0]?.id ?? "",
                sizeClass,
                addOnIds: snapshot?.add_on_ids ?? [],
                addressLine: b.address_line ?? "",
                postcode: b.postcode,
                resourceId: b.resource_id,
                staffId: b.staff_id ?? "",
                price: (b.price_pence / 100).toFixed(2),
                durationMins: minutes,
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>More than one car</CardTitle>
            <CardDescription>Each car adds its price and time to this booking.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {carsResult.data.length > 0 && (
              <ul className="divide-y rounded-lg border">
                {carsResult.data.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span>
                      {extraCarLabel(c).replace("Extra car: ", "")}
                      <span className="block text-xs text-muted-foreground">
                        {[c.registration, formatPence(c.price_pence), c.extra_mins ? `${c.extra_mins} mins` : null].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <RemoveExtraCar label={extraCarLabel(c).replace("Extra car: ", "")} action={removeExtraCarAction.bind(null, slug, id, c.id)} />
                  </li>
                ))}
              </ul>
            )}
            <ExtraCarForm action={addExtraCarAction.bind(null, slug, id)} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
