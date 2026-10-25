import "server-only";
import { cache } from "react";
import { weeklyHoursSchema, type WeeklyHours } from "@leadgen/core/booking/config";
import { setupProgress, setupSteps, type SetupInput } from "@leadgen/core/onboarding/steps";
import { isCustomHostname } from "@leadgen/core/tenants";
import { createClient } from "@/lib/supabase/server";

// Loads what the setup checklist needs for one business. Goes through the
// signed-in user's session, so RLS limits it to their own business.

function hoursOrEmpty(value: unknown): WeeklyHours {
  const parsed = weeklyHoursSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}

// Cached per request: the Overview nudge and the setup page both call it.
export const loadSetup = cache(async (tenantId: string) => {
  const supabase = await createClient();
  const [settings, services, tenant, domains, bookings, leads] = await Promise.all([
    supabase
      .from("booking_settings")
      .select("offers_mobile, offers_unit, weekly_hours, unit_weekly_hours, base_postcode, deposit")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    supabase.from("services").select("name, duration_mins, base_price_pence, active").eq("tenant_id", tenantId),
    supabase.from("tenants").select("stripe_account_id, stripe_ready").eq("id", tenantId).single(),
    supabase.from("domains").select("hostname, verified, is_primary").eq("tenant_id", tenantId),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .in("status", ["confirmed", "completed"]),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
  ]);
  for (const r of [settings, services, tenant, domains, bookings, leads]) if (r.error) throw r.error;

  // No settings row means booking was never set up for this business; the
  // page says so rather than guessing at defaults.
  if (!settings.data) return null;

  const depositType = (settings.data.deposit as { type?: string } | null)?.type;
  const input: SetupInput = {
    services: services.data ?? [],
    offersMobile: settings.data.offers_mobile,
    offersUnit: settings.data.offers_unit,
    weeklyHours: hoursOrEmpty(settings.data.weekly_hours),
    unitWeeklyHours: settings.data.unit_weekly_hours ? hoursOrEmpty(settings.data.unit_weekly_hours) : null,
    basePostcode: settings.data.base_postcode,
    depositType: depositType === "percent" || depositType === "fixed" || depositType === "full" ? depositType : "none",
    stripe: tenant.data!.stripe_ready ? "connected" : tenant.data!.stripe_account_id ? "pending" : "none",
    enquiries: (bookings.count ?? 0) + (leads.count ?? 0),
  };

  const steps = setupSteps(input);
  return {
    steps,
    progress: setupProgress(steps),
    // Its verified custom domain, if any: where tenantUrl() points its booking pages.
    customDomain: domains.data?.find((d) => d.verified && d.is_primary && isCustomHostname(d.hostname))?.hostname ?? null,
    offersMobile: input.offersMobile,
  };
});
