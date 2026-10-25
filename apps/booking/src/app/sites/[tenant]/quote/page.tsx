import type { Metadata } from "next";
import Link from "next/link";
import { bookableDatesForAny } from "@leadgen/core/booking/capacity";
import type { LocationType } from "@leadgen/core/booking/config";
import { localDate } from "@leadgen/core/booking/time";
import { getBookingConfig } from "@leadgen/core/booking/engine";
import { DEFAULT_MARKETING_CONSENT } from "@leadgen/core/settings/forms";
import { policyLines, policyOf } from "@leadgen/core/settings/policy";
import { questionsOf } from "@leadgen/core/settings/questions";
import { getTenantPayments } from "@leadgen/core/stripe/accounts";
import { requireRequestTenant } from "@/lib/tenant";
import { pageUrl } from "@/lib/urls";
import { BookingFlow } from "./booking-flow";

export const metadata: Metadata = { title: "Instant quote" };

export default async function QuotePage({ searchParams }: PageProps<"/sites/[tenant]/quote">) {
  const tenant = await requireRequestTenant();
  const config = await getBookingConfig(tenant.id);
  // Opened inside the embed script's panel: the panel has its own header.
  const query = await searchParams;
  const embedded = query.embed === "1";
  // The owner sets this in Settings. While developing, a business with none
  // set points at the local test site.
  const websiteUrl =
    tenant.branding.website_url ?? (process.env.NODE_ENV === "development" ? "http://localhost:4321" : undefined);
  const serviceParam = typeof query.service === "string" ? query.service.trim().toLowerCase() : "";

  // offers_mobile / offers_unit here already mean "switched on and has a van
  // or bay to do it".
  if (!config || !config.services.length || !(config.settings.offers_mobile || config.settings.offers_unit)) {
    return (
      <main className="flex flex-1 items-center justify-center p-4 text-center text-sm text-neutral-500">
        Online booking isn&apos;t open yet. Please get in touch with {tenant.name} directly.
      </main>
    );
  }

  // ?service= preselects a service so a customer who clicked "Book" on one
  // doesn't pick it again. Takes the service's slug (what a website owner
  // writes: ?service=full-valet) or its id (what the API's bookUrl uses, and
  // survives a rename). Anything else, or a service that's switched off, just
  // starts at the first step.
  const initialServiceId = serviceParam
    ? config.services.find((s) => s.id === serviceParam || s.slug === serviceParam)?.id
    : undefined;

  const { settings } = config;
  const offered = [settings.offers_mobile && "mobile", settings.offers_unit && "unit"].filter(Boolean) as LocationType[];
  const payments = await getTenantPayments(tenant.id);
  const policy = policyOf(settings.cancellation_policy);
  return (
    <main className="flex flex-1 flex-col">
      {!embedded && (
        <header className="flex items-center justify-between gap-4 bg-brand px-4 py-3 text-brand-fg">
          <Link href={pageUrl(tenant)} className="font-semibold">
            {tenant.name}
          </Link>
          {websiteUrl && (
            <a href={websiteUrl} className="shrink-0 text-sm opacity-80 hover:opacity-100">
              &larr; Back to website
            </a>
          )}
        </header>
      )}
      <div className={`mx-auto w-full flex-1 px-4 py-6 ${embedded ? "max-w-lg" : "max-w-5xl"}`}>
        {!embedded && (
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Book your appointment</h1>
            <p className="mt-1 text-neutral-600">
              Choose your service, tell us about the car and pick a time. You&apos;ll see the price as you go.
            </p>
          </div>
        )}
        <BookingFlow
          tenantName={tenant.name}
          tenant={{ slug: tenant.slug, customDomain: tenant.customDomain }}
          services={config.services}
          addOns={config.addOns}
          // Only what the customer needs; the base postcode and other
          // internal settings stay on the server.
          pricing={{
            offers_mobile: settings.offers_mobile,
            offers_unit: settings.offers_unit,
            deposit: settings.deposit,
            min_price_pence: settings.min_price_pence,
            mobile_surcharge_pence: settings.mobile_surcharge_pence,
            condition_tiers: settings.condition_tiers,
          }}
          unitAddress={
            settings.offers_unit
              ? [settings.unit_address, settings.unit_postcode].filter(Boolean).join(", ")
              : null
          }
          timezone={settings.timezone}
          today={localDate(new Date(), settings.timezone)}
          dates={bookableDatesForAny(settings, config.resources, offered, new Date())}
          stripeReady={payments.ready}
          initialServiceId={initialServiceId}
          embedded={embedded}
          questions={questionsOf(settings.questions)}
          minPhotos={settings.photos_required ? settings.min_photos : 0}
          needsApproval={settings.approval_mode === "manual"}
          policy={policy ? policyLines(policy, settings.deposit.type !== "none") : null}
          consentText={tenant.privacy.marketingConsentText ?? DEFAULT_MARKETING_CONSENT}
          privacyUrl={tenant.privacy.policyUrl ?? pageUrl(tenant, "/privacy")}
        />
      </div>
    </main>
  );
}
