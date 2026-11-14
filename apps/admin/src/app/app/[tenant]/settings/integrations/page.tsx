import type { Metadata } from "next";
import { connection } from "next/server";
import { listApiKeys } from "@leadgen/core/api/keys";
import { googleCalendarConfigured } from "@leadgen/core/calendar/google";
import { loadCalendarSettings } from "@leadgen/core/calendar/sync";
import { formatDateTime } from "@leadgen/core/dates";
import { metaConfigured } from "@leadgen/core/meta/graph";
import { listPageOptions, loadMetaSettings } from "@leadgen/core/meta/leads";
import { listLocationOptions, loadReviewSettings } from "@leadgen/core/reviews/sync";
import { listEndpoints, MAX_ENDPOINTS } from "@leadgen/core/webhooks/deliver";
import { ApiKeys } from "@/components/dashboard/api-keys";
import { GoogleCalendarCard } from "@/components/dashboard/settings/google-calendar-card";
import { GoogleReviewsCard } from "@/components/dashboard/settings/google-reviews-card";
import { MetaLeadsCard } from "@/components/dashboard/settings/meta-leads-card";
import { Webhooks } from "@/components/dashboard/settings/webhooks";
import { CopyText } from "@/components/platform/copy-text";
import { SettingsSection, SettingsStack } from "@/components/dashboard/settings/section";
import { Badge } from "@/components/ui/badge";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createKeyAction, revokeKeyAction } from "../api/actions";
import {
  chooseMetaPageAction,
  chooseReviewLocationAction,
  createWebhookAction,
  deleteWebhookAction,
  disconnectCalendarAction,
  disconnectMetaAction,
  disconnectReviewsAction,
  refreshReviewsAction,
  resendDeliveryAction,
  rollWebhookSecretAction,
  saveCalendarAction,
  testWebhookAction,
  updateWebhookAction,
} from "./actions";
import { apiUrl, appUrl, docsUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Integrations" };

// Without these, connecting Google can't work: named in development only.
function calendarMissing() {
  if (process.env.NODE_ENV === "production") return null;
  const missing = ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", "CALENDAR_TOKEN_SECRET"].filter((n) => !process.env[n]);
  return missing.length ? `Development: set ${missing.join(", ")} in the root .env.local (see .env.example).` : null;
}

function metaMissing() {
  if (process.env.NODE_ENV === "production") return null;
  const missing = ["META_APP_ID", "META_APP_SECRET", "META_WEBHOOK_VERIFY_TOKEN", "CALENDAR_TOKEN_SECRET"].filter((n) => !process.env[n]);
  return missing.length ? `Development: set ${missing.join(", ")} in the root .env.local (see .env.example).` : null;
}

// Each card still shows if its own tables can't be read (a migration not run yet).
function orNull<T>(what: string, promise: Promise<T>): Promise<T | null> {
  return promise.catch((error) => {
    console.error(`Loading ${what} failed`, error);
    return null;
  });
}

export default async function IntegrationsPage({ params, searchParams }: PageProps<"/app/[tenant]/settings/integrations">) {
  const { tenant: slug } = await params;
  const { tenant, can } = await requireAccess(slug, "settings.edit");
  const sp = await searchParams;

  // Per-request: the key list, "last used" dates and the calendar connection
  // must never be prerendered.
  await connection();
  const developer = can("api");
  const [keys, calendar, reviews, meta, webhooks, zone] = await Promise.all([
    developer ? listApiKeys(await createClient(), tenant.id) : [],
    orNull("Google Calendar settings", loadCalendarSettings(tenant.id)),
    orNull("Google Business settings", loadReviewSettings(tenant.id)),
    orNull("Facebook settings", loadMetaSettings(tenant.id)),
    developer ? orNull("webhooks", listEndpoints(tenant.id)) : null,
    (await createClient()).from("booking_settings").select("timezone").eq("tenant_id", tenant.id).maybeSingle(),
  ]);
  const timeZone = zone.data?.timezone ?? "Europe/London";
  const sealing = Boolean(process.env.CALENDAR_TOKEN_SECRET);
  const configured = googleCalendarConfigured() && sealing;
  const metaReady = metaConfigured() && sealing && Boolean(process.env.META_WEBHOOK_VERIFY_TOKEN);
  // Asked of Google or Facebook only while something still has to be picked.
  const [locations, pages] = await Promise.all([
    reviews?.status === "active" && !reviews.locationChosen ? listLocationOptions(tenant.id) : null,
    meta?.status === "choose_page" ? listPageOptions(tenant.id) : null,
  ]);
  const outcome = (key: string) => (typeof sp[key] === "string" ? (sp[key] as string) : null);
  const endpoint = apiUrl("/v1/catalog", { absolute: true });
  const docs = docsUrl();

  // Indented by hand, so it reads as it should when pasted.
  const astro = [
    "---",
    `const res = await fetch("${endpoint}", {`,
    "  headers: { Authorization: `Bearer ${import.meta.env.BOOKING_API_KEY}` },",
    "});",
    "const { services, addOns } = await res.json();",
    "---",
    "{services.map((s) => (",
    "  <a href={s.bookUrl}>{s.name}: from {s.price.from}</a>",
    "))}",
  ].join("\n");
  const link = "underline underline-offset-4 hover:text-foreground";

  return (
    <SettingsStack>
      <SettingsSection
        id="apps"
        title="Connected apps"
        description="Bring your calendar, reviews and ad enquiries into the dashboard. You can disconnect any of them at any time."
        bare
      >
        <ul className="grid gap-3">
          {calendar && (
            <GoogleCalendarCard
              configured={configured}
              missingHint={calendarMissing()}
              canEdit={can("settings.edit")}
              connectHref={apiUrl(`/google/calendar/connect?tenant=${encodeURIComponent(slug)}`)}
              outcome={outcome("google")}
              {...calendar}
              saveAction={saveCalendarAction.bind(null, slug)}
              disconnectAction={disconnectCalendarAction.bind(null, slug)}
            />
          )}
          <GoogleReviewsCard
            configured={configured}
            canEdit={can("settings.edit")}
            connectHref={apiUrl(`/google/business/connect?tenant=${encodeURIComponent(slug)}`)}
            reviewsHref={appUrl(`/${slug}/reviews`)}
            outcome={outcome("reviews")}
            connection={reviews}
            locations={locations}
            chooseAction={chooseReviewLocationAction.bind(null, slug)}
            refreshAction={refreshReviewsAction.bind(null, slug)}
            disconnectAction={disconnectReviewsAction.bind(null, slug)}
          />
          <MetaLeadsCard
            configured={metaReady}
            missingHint={metaMissing()}
            canEdit={can("settings.edit")}
            connectHref={apiUrl(`/meta/connect?tenant=${encodeURIComponent(slug)}`)}
            leadsHref={appUrl(`/${slug}/leads`)}
            outcome={outcome("meta")}
            connection={meta}
            pages={pages}
            lastLeadLabel={meta?.lastLeadAt ? formatDateTime(meta.lastLeadAt, timeZone) : null}
            chooseAction={chooseMetaPageAction.bind(null, slug)}
            disconnectAction={disconnectMetaAction.bind(null, slug)}
          />
        </ul>
      </SettingsSection>

      {/* For the few who build their own website. The old /settings/api address lands here. */}
      {developer && (
        <>
          <SettingsSection
            id="developer"
            title="API keys"
            badge={<Badge>For developers</Badge>}
            description={
              <>
                For whoever builds your website; you don&apos;t need these to take bookings. Your site can pull your
                services, prices, opening hours and free times from here, so it always matches your booking page. Keys can
                also read bookings, customers and enquiries, or send enquiries in from your own forms, but only if you tick
                that when you make the key. Each key only ever reaches {tenant.name}&apos;s data.
              </>
            }
          >
            <div className="grid gap-8">
              <ApiKeys keys={keys} createAction={createKeyAction.bind(null, slug)} revokeAction={revokeKeyAction.bind(null, slug)} />

              <div className="grid gap-3 border-t pt-6">
                <h3 className="font-semibold">How to use it</h3>
                <p className="text-muted-foreground">Send a GET request with your key in the Authorization header:</p>
                <CopyText value={endpoint} label="endpoint" />
                <pre className="overflow-x-auto rounded-lg bg-muted/50 p-3 text-xs">
                  {`curl ${endpoint} \\\n  -H "Authorization: Bearer YOUR_API_KEY"`}
                </pre>
                <p className="text-muted-foreground">
                  In an Astro site, put the key in <code className="rounded bg-muted px-1">.env</code> as{" "}
                  <code className="rounded bg-muted px-1">BOOKING_API_KEY</code> and fetch it when the page builds:
                </p>
                <pre className="overflow-x-auto rounded-lg bg-muted/50 p-3 text-xs">{astro}</pre>
                <p className="text-muted-foreground">
                  Call it from your website&apos;s server or build, not from code that runs in visitors&apos; browsers: that
                  would show them your key. Responses include an ETag, so checking often is cheap when nothing has changed.
                </p>
                {docs && (
                  <p>
                    <a href={docsUrl("/api")} target="_blank" rel="noreferrer" className={link}>
                      Read the full API docs
                    </a>{" "}
                    <span className="text-muted-foreground">for every endpoint and field, TypeScript types, error codes and examples.</span>
                  </p>
                )}
              </div>
            </div>
          </SettingsSection>

          <SettingsSection
            id="webhooks"
            title="Webhooks"
            badge={<Badge>For developers</Badge>}
            description={
              <>
                New bookings, changes, cancellations and enquiries sent to your own system (or Zapier, Make and the like) as
                they happen, as signed JSON. Anything that doesn&apos;t get through is tried again for a day.
                {docs && (
                  <span className="mt-2 block">
                    <a href={docsUrl("/api/webhooks")} target="_blank" rel="noreferrer" className={link}>
                      How to check the signature
                    </a>{" "}
                    and what each event contains.
                  </span>
                )}
              </>
            }
          >
            {webhooks === null ? (
              <p className="text-muted-foreground">Webhooks can&apos;t be loaded just now. Reload to try again.</p>
            ) : (
              <Webhooks
                endpoints={webhooks}
                max={MAX_ENDPOINTS}
                createAction={createWebhookAction.bind(null, slug)}
                updateAction={updateWebhookAction.bind(null, slug)}
                deleteAction={deleteWebhookAction.bind(null, slug)}
                rollAction={rollWebhookSecretAction.bind(null, slug)}
                testAction={testWebhookAction.bind(null, slug)}
                resendAction={resendDeliveryAction.bind(null, slug)}
              />
            )}
          </SettingsSection>
        </>
      )}
    </SettingsStack>
  );
}
