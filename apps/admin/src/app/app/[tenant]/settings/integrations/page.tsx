import type { Metadata } from "next";
import { connection } from "next/server";
import { listApiKeys } from "@leadgen/core/api/keys";
import { googleCalendarConfigured } from "@leadgen/core/calendar/google";
import { loadCalendarSettings } from "@leadgen/core/calendar/sync";
import { ApiKeys } from "@/components/dashboard/api-keys";
import { GoogleCalendarCard } from "@/components/dashboard/settings/google-calendar-card";
import { CopyText } from "@/components/platform/copy-text";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createKeyAction, revokeKeyAction } from "../api/actions";
import { disconnectCalendarAction, saveCalendarAction } from "./actions";
import { apiUrl, docsUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Integrations" };

// Without these, connecting Google can't work: named in development only.
function calendarMissing() {
  if (process.env.NODE_ENV === "production") return null;
  const missing = ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", "CALENDAR_TOKEN_SECRET"].filter((n) => !process.env[n]);
  return missing.length ? `Development: set ${missing.join(", ")} in the root .env.local (see .env.example).` : null;
}

export default async function IntegrationsPage({ params, searchParams }: PageProps<"/app/[tenant]/settings/integrations">) {
  const { tenant: slug } = await params;
  const { tenant, can } = await requireAccess(slug, "settings.edit");
  const sp = await searchParams;

  // Per-request: the key list, "last used" dates and the calendar connection
  // must never be prerendered.
  await connection();
  const developer = can("api");
  const [keys, calendar] = await Promise.all([
    developer ? listApiKeys(await createClient(), tenant.id) : [],
    // The rest of the page still works if the calendar tables can't be read.
    loadCalendarSettings(tenant.id).catch((error) => {
      console.error("Loading Google Calendar settings failed", error);
      return null;
    }),
  ]);
  const configured = googleCalendarConfigured() && Boolean(process.env.CALENDAR_TOKEN_SECRET);
  const endpoint = apiUrl("/v1/catalog", { absolute: true });
  const docs = docsUrl();

  return (
    <div className="grid max-w-3xl gap-6">
      <section aria-labelledby="connected-apps" className="grid gap-3">
        <h2 id="connected-apps" className="font-medium">
          Connected apps
        </h2>
        <ul className="grid gap-3">
          {calendar && (
            <GoogleCalendarCard
              configured={configured}
              missingHint={calendarMissing()}
              canEdit={can("settings.edit")}
              connectHref={apiUrl(`/google/calendar/connect?tenant=${encodeURIComponent(slug)}`)}
              outcome={typeof sp.google === "string" ? sp.google : null}
              {...calendar}
              saveAction={saveCalendarAction.bind(null, slug)}
              disconnectAction={disconnectCalendarAction.bind(null, slug)}
            />
          )}
          {COMING.map((c) => (
            <li key={c.name} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-card p-4">
              <span className="min-w-0">
                <span className="font-medium">{c.name}</span>
                <span className="block text-sm text-muted-foreground">{c.detail}</span>
              </span>
              <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{c.status}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* For the few who build their own website: tucked away, unless they already use it. */}
      {developer && (
        <details id="developer" className="group rounded-xl border bg-card" open={keys.length > 0 ? true : undefined}>
          <summary className="cursor-pointer px-4 py-3 font-medium">
            Developer: API keys and webhooks
            <span className="block text-sm font-normal text-muted-foreground">
              For whoever builds your website. You don&apos;t need these to take bookings.
            </span>
          </summary>
          <div className="grid gap-10 border-t px-4 py-6">
            <section aria-labelledby="api-intro" className="grid gap-2">
              <h2 id="api-intro" className="font-medium">
                Use your product data on your own website
              </h2>
              <p className="text-sm text-muted-foreground">
                Your website can pull your services, prices, add-ons and service page content from here, so it always matches
                your booking page. Each key only ever returns {tenant.name}&apos;s data. No customer details are shared.
              </p>
            </section>

            <section aria-labelledby="api-keys" className="grid gap-3">
              <h2 id="api-keys" className="font-medium">
                API keys
              </h2>
              <ApiKeys
                keys={keys}
                createAction={createKeyAction.bind(null, slug)}
                revokeAction={revokeKeyAction.bind(null, slug)}
              />
            </section>

            <section aria-labelledby="api-usage" className="grid gap-3 text-sm">
              <h2 id="api-usage" className="font-medium">
                How to use it
              </h2>
              <p className="text-muted-foreground">Send a GET request with your key in the Authorization header:</p>
              <CopyText value={endpoint} label="endpoint" />
              <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 text-xs">
                {`curl ${endpoint} \\\n  -H "Authorization: Bearer YOUR_API_KEY"`}
              </pre>
              <p className="text-muted-foreground">
                In an Astro site, put the key in <code>.env</code> as <code>BOOKING_API_KEY</code> and fetch it when the page
                builds:
              </p>
              <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 text-xs">
                {`---
    const res = await fetch("${endpoint}", {
      headers: { Authorization: \`Bearer \${import.meta.env.BOOKING_API_KEY}\` },
    });
    const { services, addOns } = await res.json();
    ---
    {services.map((s) => (
      <a href={s.bookUrl}>{s.name}: from {s.price.from}</a>
    ))}`}
              </pre>
              <p className="text-muted-foreground">
                Call it from your website&apos;s server or build, not from code that runs in visitors&apos; browsers: that
                would show them your key. Responses include an ETag, so checking often is cheap when nothing has changed.
              </p>
              {docs && (
                <p>
                  <a href={docsUrl("/api")} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                    Read the full API docs
                  </a>{" "}
                  <span className="text-muted-foreground">for every field, error codes and examples for WordPress, Next.js and more.</span>
                </p>
            )}
          </section>

          <section aria-labelledby="webhooks" className="grid gap-2 text-sm">
            <h2 id="webhooks" className="font-medium">
              Webhooks
            </h2>
            <p className="text-muted-foreground">
              Have new bookings, cancellations and enquiries sent to your own system as they happen. Coming soon.
            </p>
          </section>
        </div>
      </details>
      )}
    </div>
  );
}

const COMING = [
  { name: "Google Business reviews", detail: "See new reviews here and reply to them.", status: "Later" },
  { name: "Facebook and Instagram lead forms", detail: "Enquiries from Meta lead ads arrive as leads here.", status: "Later" },
];
