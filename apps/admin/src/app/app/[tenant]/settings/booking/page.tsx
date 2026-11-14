import type { Metadata } from "next";
import { z } from "zod";
import { summariseCapacity } from "@leadgen/core/booking/capacity";
import { bookingSettingsSchema, resourceSchema } from "@leadgen/core/booking/config";
import { policyOf, storedPolicyOf } from "@leadgen/core/settings/policy";
import { questionsOf } from "@leadgen/core/settings/questions";
import { BookingRulesForm, HoursForm, LocationsForm, NewResource, ResourceEditor } from "@/components/dashboard/booking-settings-forms";
import { AskingForm, PolicyForm } from "@/components/dashboard/settings/booking-forms";
import { ReadOnlyNotice, SettingsSection, SettingsStack } from "@/components/dashboard/settings/section";
import { SortableRows } from "@/components/dashboard/sortable";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { deleteResource, reorderResources, saveAsking, saveBookingRules, saveHours, saveLocations, savePolicy, saveResource } from "./actions";

export const metadata: Metadata = { title: "Hours & rules" };

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
    return <EmptyState>Booking isn&apos;t set up for this business yet.</EmptyState>;
  }
  const settings = bookingSettingsSchema.parse(settingsResult.data);
  const resources = z.array(resourceSchema.extend({ active: z.boolean() })).parse(resourcesResult.data);
  const summary = summariseCapacity(settings, resources);
  const suggestion = `${settings.offers_unit && !settings.offers_mobile ? "Bay" : "Van"} ${resources.length + 1}`;

  const tiles = [
    settings.offers_mobile && { label: "Mobile jobs at once", value: summary.mobile },
    settings.offers_unit && { label: "Shop jobs at once", value: summary.unit },
  ].filter(Boolean) as { label: string; value: number }[];

  return (
    <SettingsStack>
      {readOnly && <ReadOnlyNotice />}

      <SettingsSection
        id="capacity"
        title="What you can take"
        description="Worked out from where you work, your vans and bays, and their hours below."
      >
        <div className="grid gap-4">
          <dl className={cn("grid gap-3", tiles.length > 1 && "@md:grid-cols-2")}>
            {tiles.map((t) => (
              <div key={t.label} className="rounded-lg bg-muted/50 p-4">
                <dt className="text-sm text-muted-foreground">{t.label}</dt>
                <dd className={cn("text-3xl font-semibold tabular-nums", t.value === 0 && "text-muted-foreground")}>{t.value}</dd>
              </div>
            ))}
          </dl>
          {summary.mobile === 0 && summary.unit === 0 && (
            <p className="font-medium">Nothing can be booked online right now.</p>
          )}
          {summary.warnings.length > 0 && (
            <ul className="grid gap-2">
              {summary.warnings.map((w) => (
                <li key={w} className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                  {w}
                </li>
              ))}
            </ul>
          )}
        </div>
      </SettingsSection>

      <SettingsSection id="locations" title="Where you work" description="Mobile jobs at the customer's address, jobs at your own shop or unit, or both.">
        <LocationsForm settings={settings} action={saveLocations.bind(null, slug)} readOnly={readOnly} />
      </SettingsSection>

      <SettingsSection
        id="resources"
        title="Vans and bays"
        description={
          <>
            Each one does one job at a time, so three vans means three customers can book the same hour. Bookings go to the
            first free one in this order{readOnly ? "" : "; drag to change it"}.
            {resources.length === 0 && <span className="mt-2 block font-medium text-foreground">You have none yet.</span>}
          </>
        }
      >
        <div className="grid gap-3">
          <SortableRows
            readOnly={readOnly}
            save={reorderResources.bind(null, slug)}
            items={resources.map((r) => ({
              id: r.id,
              label: r.name,
              content: (
                <ResourceEditor
                  resource={r}
                  action={saveResource.bind(null, slug, r.id)}
                  deleteAction={deleteResource.bind(null, slug, r.id)}
                  readOnly={readOnly}
                />
              ),
            }))}
          />
          <NewResource action={saveResource.bind(null, slug, null)} readOnly={readOnly} suggestion={suggestion} />
        </div>
      </SettingsSection>

      <SettingsSection
        id="hours"
        title="Opening hours"
        description="When customers can book. A van or bay can have its own hours instead, under Vans and bays."
      >
        <HoursForm settings={settings} action={saveHours.bind(null, slug)} readOnly={readOnly} />
      </SettingsSection>

      <SettingsSection id="rules" title="Booking rules" description="Which times are offered, and the gaps kept between jobs.">
        <BookingRulesForm settings={settings} action={saveBookingRules.bind(null, slug)} readOnly={readOnly} />
      </SettingsSection>

      <SettingsSection
        id="asking"
        title="Approval, photos and questions"
        description="Whether you check bookings before they're confirmed, and what customers are asked."
      >
        <AskingForm
          settings={settings}
          questions={questionsOf(settings.questions)}
          action={saveAsking.bind(null, slug)}
          readOnly={readOnly}
        />
      </SettingsSection>

      <SettingsSection
        id="policy"
        title="Cancellations and changes"
        description="How late customers can cancel or move a booking. What happens to their deposit is under Payments."
      >
        <PolicyForm
          policy={policyOf(settings.cancellation_policy)}
          stored={storedPolicyOf(settings.cancellation_policy)}
          action={savePolicy.bind(null, slug)}
          readOnly={readOnly}
        />
      </SettingsSection>
    </SettingsStack>
  );
}
