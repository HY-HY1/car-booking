import type { Metadata } from "next";
import { z } from "zod";
import { getBookingConfig } from "@leadgen/core/booking/engine";
import { isIsoDate, localDate } from "@leadgen/core/booking/time";
import { BackLink, PageHeader } from "@/components/dashboard/page-header";
import { NewBookingForm } from "@/components/dashboard/new-booking-form";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/urls";
import { createBookingAction } from "./actions";

export const metadata: Metadata = { title: "Add booking" };

// A booking the business takes itself: on the phone, a regular, a walk-in.
// ?customer=<id> fills in a customer ("Book again" on their page), and
// ?date=, ?time= and ?resource= a time from the diary.
export default async function NewBookingPage({ params, searchParams }: PageProps<"/app/[tenant]/bookings/new">) {
  const { tenant: slug } = await params;
  const { tenant } = await requireAccess(slug, "bookings.manage");
  const sp = await searchParams;
  const param = (key: string) => (typeof sp[key] === "string" ? (sp[key] as string) : "");

  const config = await getBookingConfig(tenant.id);
  const supabase = await createClient();
  const customerId = z.uuid().safeParse(param("customer")).success ? param("customer") : null;
  const [payments, customer] = await Promise.all([
    supabase.from("tenants").select("stripe_ready").eq("id", tenant.id).single(),
    customerId
      ? supabase
          .from("customers")
          .select("id, name, email, phone, address_line, postcode")
          .eq("tenant_id", tenant.id)
          .eq("id", customerId)
          .maybeSingle()
      : null,
  ]);
  if (payments.error) throw payments.error;
  if (customer?.error) throw customer.error;

  const back = <BackLink href={appUrl(`/${slug}/diary`)}>Diary</BackLink>;
  if (!config || config.services.length === 0) {
    return (
      <>
        {back}
        <PageHeader title="Add booking" />
        <p className="text-sm text-muted-foreground">
          Add your services under Pricing, and your vans or bays under Settings → Hours & rules, to start taking bookings.
        </p>
      </>
    );
  }

  const { settings } = config;
  const today = localDate(new Date(), settings.timezone);
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(param("time")) ? param("time") : "09:00";

  return (
    <>
      {back}
      <PageHeader
        title="Add booking"
        description="A booking you've taken yourself, on the phone or in person. It goes straight into the diary as confirmed."
      />
      <NewBookingForm
        action={createBookingAction.bind(null, slug)}
        services={config.services.map((s) => ({
          id: s.id,
          name: s.name,
          duration_mins: s.duration_mins,
          base_price_pence: s.base_price_pence,
          size_adjustments: s.size_adjustments,
          location_types: s.location_types,
          description: null,
        }))}
        addOns={config.addOns}
        pricing={{
          offers_mobile: true,
          offers_unit: true,
          deposit: settings.deposit,
          min_price_pence: settings.min_price_pence,
          mobile_surcharge_pence: settings.mobile_surcharge_pence,
          condition_tiers: settings.condition_tiers,
        }}
        resources={config.resources.map((r) => ({ id: r.id, name: r.name, location_types: r.location_types }))}
        hasUnit={!!settings.unit_postcode}
        unitAddress={settings.unit_address}
        stripeReady={payments.data.stripe_ready}
        defaults={{
          date: isIsoDate(param("date")) ? param("date") : today,
          time,
          resourceId: param("resource"),
          customer: customer?.data ?? null,
        }}
      />
    </>
  );
}
