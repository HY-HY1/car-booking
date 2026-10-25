import type { Metadata } from "next";
import { z } from "zod";
import { summariseCapacity } from "@leadgen/core/booking/capacity";
import { bookingSettingsSchema, resourceSchema } from "@leadgen/core/booking/config";
import { policyOf } from "@leadgen/core/settings/policy";
import { questionsOf } from "@leadgen/core/settings/questions";
import { BookingRulesForm, HoursForm, LocationsForm, NewResource, ResourceEditor } from "@/components/dashboard/booking-settings-forms";
import { AskingForm, PolicyForm } from "@/components/dashboard/settings/booking-forms";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deleteResource, saveAsking, saveBookingRules, saveHours, saveLocations, savePolicy, saveResource } from "./actions";

export const metadata: Metadata = { title: "Booking settings" };

export default async function BookingSettingsPage({ params }: PageProps<"/app/[tenant]/settings/booking">) {
  const { tenant: slug } = await params;
  const { tenant, can } = await requireAccess(slug, "settings.view");
  const readOnly = !can("settings.edit");

  // RLS limits every read to this business.
  const supabase = await createClient();
  const [settingsResult, resourcesResult] = await Promise.all([
    supabase.from("booking_settings").select("*").eq("tenant_id", tenant.id).maybeSingle(),
    supabase
      .from("resources")
      .select("id, name, location_types, weekly_hours, sort_order, active")
      .eq("tenant_id", tenant.id)
      .order("sort_order")
      .order("created_at"),
  ]);
  if (settingsResult.error) throw settingsResult.error;
  if (resourcesResult.error) throw resourcesResult.error;

  if (!settingsResult.data) {
    return <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Booking isn&apos;t set up for this business yet.</p>;
  }
  const settings = bookingSettingsSchema.parse(settingsResult.data);
  const resources = z.array(resourceSchema.extend({ active: z.boolean() })).parse(resourcesResult.data);
  const summary = summariseCapacity(settings, resources);

  const mobileCount = resources.filter((r) => r.location_types.includes("mobile")).length;
  const suggestion = `${settings.offers_unit && !settings.offers_mobile ? "Bay" : "Van"} ${resources.length + 1}`;

  return (
    <div className="grid max-w-3xl gap-10">
      {readOnly && (
        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">Your access level lets you see these but not change them.</p>
      )}

      <section aria-labelledby="capacity-heading" className="grid gap-3">
        <h2 id="capacity-heading" className="font-medium">
          What you can take at once
        </h2>
        <p className="text-sm">
          {summary.mobile === 0 && summary.unit === 0
            ? "Nothing can be booked online right now."
            : [
                summary.mobile > 0 && `${summary.mobile} mobile ${summary.mobile === 1 ? "job" : "jobs"}`,
                summary.unit > 0 && `${summary.unit} shop ${summary.unit === 1 ? "job" : "jobs"}`,
              ]
                .filter(Boolean)
                .join(" and ") + " at the same time."}
        </p>
        {summary.warnings.length > 0 && (
          <ul className="grid gap-2">
            {summary.warnings.map((w) => (
              <li key={w} className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {w}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="locations-heading" className="grid gap-3">
        <h2 id="locations-heading" className="font-medium">
          Where you work
        </h2>
        <LocationsForm settings={settings} action={saveLocations.bind(null, slug)} readOnly={readOnly} />
      </section>

      <section aria-labelledby="resources-heading" className="grid gap-3">
        <h2 id="resources-heading" className="font-medium">
          Vans and bays
        </h2>
        <p className="text-sm text-muted-foreground">
          Each one does one job at a time, so three vans means three customers can book the same hour. A time is on
          offer while any of them is free; the booking goes to the first free one in this order. Give one its own
          hours if it works different days, or set it to do both mobile and shop work if one person covers both.
          {mobileCount === 0 && " You have none yet."}
        </p>
        {resources.map((r) => (
          <ResourceEditor
            key={r.id}
            resource={r}
            action={saveResource.bind(null, slug, r.id)}
            deleteAction={deleteResource.bind(null, slug, r.id)}
            readOnly={readOnly}
          />
        ))}
        <NewResource action={saveResource.bind(null, slug, null)} readOnly={readOnly} suggestion={suggestion} />
      </section>

      <section aria-labelledby="hours-heading" className="grid gap-3">
        <h2 id="hours-heading" className="font-medium">
          Opening hours
        </h2>
        <HoursForm settings={settings} action={saveHours.bind(null, slug)} readOnly={readOnly} />
      </section>

      <section aria-labelledby="rules-heading" className="grid gap-3">
        <h2 id="rules-heading" className="font-medium">
          Booking rules
        </h2>
        <BookingRulesForm settings={settings} action={saveBookingRules.bind(null, slug)} readOnly={readOnly} />
      </section>

      <section aria-labelledby="asking-heading" className="grid gap-3">
        <h2 id="asking-heading" className="font-medium">
          Approval, photos and questions
        </h2>
        <AskingForm
          settings={settings}
          questions={questionsOf(settings.questions)}
          action={saveAsking.bind(null, slug)}
          readOnly={readOnly}
        />
      </section>

      <section aria-labelledby="policy-heading" className="grid gap-3">
        <h2 id="policy-heading" className="font-medium">
          Cancellations and changes
        </h2>
        <PolicyForm policy={policyOf(settings.cancellation_policy)} action={savePolicy.bind(null, slug)} readOnly={readOnly} />
      </section>
    </div>
  );
}
