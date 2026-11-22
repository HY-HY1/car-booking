import type { Metadata } from "next";
import { dnsRecords } from "@leadgen/core/settings/domains";
import { brandingSchema, isCustomHostname } from "@leadgen/core/tenants";
import { AddDomainForm, BrandingForm, DomainRow, type DomainView } from "@/components/dashboard/settings/general-forms";
import { ReadOnlyNotice, SettingsSection, SettingsStack } from "@/components/dashboard/settings/section";
import { CopyText } from "@/components/platform/copy-text";
import { requireAccess } from "@/lib/auth";
import { serviceImageUrl } from "@/lib/pricing-fields";
import { createClient } from "@/lib/supabase/server";
import { tenantUrl } from "@/lib/urls";
import { HomePageForm } from "@/components/dashboard/settings/home-page-form";
import { addDomainAction, saveBrandingAction, saveHomePageAction } from "../actions";

export const metadata: Metadata = { title: "Booking page" };

export default async function BookingPageSettings({ params }: PageProps<"/app/[tenant]/settings/booking-page">) {
  const { tenant: slug } = await params;
  const { tenant, can } = await requireAccess(slug, "settings.view");
  const readOnly = !can("settings.edit");

  const supabase = await createClient();
  const [business, domains, services, shortest, booking] = await Promise.all([
    supabase.from("tenants").select("name, branding, contact_email, contact_phone").eq("id", tenant.id).single(),
    supabase
      .from("domains")
      .select("id, hostname, verified, is_primary, verification_token, check_error, created_at")
      .eq("tenant_id", tenant.id)
      .order("is_primary", { ascending: false })
      .order("created_at"),
    // The first few, for the preview.
    supabase
      .from("services")
      .select("id, name, base_price_pence, tagline, image_path")
      .eq("tenant_id", tenant.id)
      .eq("active", true)
      .not("slug", "is", null)
      .order("sort_order")
      .order("name")
      .limit(3),
    // The default length for "next free day".
    supabase
      .from("services")
      .select("duration_mins")
      .eq("tenant_id", tenant.id)
      .eq("active", true)
      .order("duration_mins")
      .limit(1)
      .maybeSingle(),
    supabase.from("booking_settings").select("offers_mobile").eq("tenant_id", tenant.id).maybeSingle(),
  ]);
  if (business.error) throw business.error;
  if (domains.error) throw domains.error;
  if (services.error) throw services.error;
  if (shortest.error) throw shortest.error;
  if (booking.error) throw booking.error;

  // The free address always works and isn't a row; the rows are the
  // business's own domains (older slug.localhost rows are skipped).
  const custom = domains.data.filter((d) => isCustomHostname(d.hostname));
  const customDomain = custom.find((d) => d.is_primary && d.verified)?.hostname ?? null;
  const free = tenantUrl(slug, "/", { absolute: true });
  const views: DomainView[] = [
    {
      id: "free",
      hostname: free.replace(/^https?:\/\//, ""),
      url: free,
      verified: true,
      isPrimary: !customDomain,
      isFallback: true,
      checkError: null,
      records: [],
    },
    ...custom.map((d) => ({
      id: d.id,
      hostname: d.hostname,
      url: tenantUrl(slug, "/", { absolute: true, customDomain: d.hostname }),
      verified: d.verified,
      isPrimary: d.is_primary && d.verified,
      isFallback: false,
      checkError: d.check_error,
      records: !d.verified && d.verification_token ? dnsRecords(d.hostname, d.verification_token) : [],
    })),
  ];
  const liveUrl = tenantUrl(slug, "/", { absolute: true, customDomain });
  const branding = brandingSchema.parse(business.data.branding ?? {});

  return (
    <SettingsStack>
      {readOnly && <ReadOnlyNotice />}
      <SettingsSection
        id="look"
        wide
        title="Look and feel"
        description="Your colours, words and pictures on the booking page, and the button on your website. The preview updates as you type."
      >
        <BrandingForm
          branding={branding}
          businessName={business.data.name}
          contact={{ email: business.data.contact_email, phone: business.data.contact_phone }}
          services={services.data.map((s) => ({
            id: s.id,
            name: s.name,
            basePricePence: s.base_price_pence,
            tagline: s.tagline,
            imageUrl: serviceImageUrl(s.image_path),
          }))}
          action={saveBrandingAction.bind(null, slug)}
          readOnly={readOnly}
        />
      </SettingsSection>

      <SettingsSection
        id="home"
        title="Home page"
        description="Sections made from your own diary and coverage, under the heading on your booking page's home."
      >
        <HomePageForm
          home={branding.home}
          shortestMins={shortest.data?.duration_mins ?? null}
          travels={Boolean(booking.data?.offers_mobile)}
          action={saveHomePageAction.bind(null, slug)}
          readOnly={readOnly}
        />
      </SettingsSection>

      <SettingsSection
        id="address"
        title="Web address"
        description={
          <>
            Your booking page always works at its free address. Add your own, like book.yourbusiness.co.uk, to use your
            domain instead.
            {custom.length > 0 && (
              <span className="mt-2 block">
                Once its DNS checks out, make it your main address. We also connect it on our side, which can take up to a
                day; until then customers use the free address.
              </span>
            )}
          </>
        }
      >
        <div className="grid gap-5">
          <ul className="grid gap-3">
            {views.map((d) => (
              <DomainRow key={d.id} slug={slug} domain={d} readOnly={readOnly} />
            ))}
          </ul>
          {!readOnly && <AddDomainForm action={addDomainAction.bind(null, slug)} />}
        </div>
      </SettingsSection>

      <SettingsSection
        id="embed"
        title="Add booking to your website"
        description="The button from Look and feel, opening your booking form in a panel without leaving your site."
      >
        <div className="grid gap-5">
          <div className="grid gap-2">
            <p className="font-medium">1. Paste this just before &lt;/body&gt; on your website</p>
            <CopyText
              value={`<script src="${tenantUrl(slug, "/embed.js", { absolute: true, customDomain })}" async></script>`}
              label="website code"
            />
            <p className="text-muted-foreground">
              Any link or button with <code className="rounded bg-muted px-1">data-instant-quote</code> opens it too. Give it
              a service&apos;s link name, like{" "}
              <code className="rounded bg-muted px-1">data-instant-quote=&quot;full-valet&quot;</code>, to start on that
              service.
            </p>
          </div>
          <div className="grid gap-2 border-t pt-5">
            <p className="font-medium">Or link straight to your booking page</p>
            <CopyText value={liveUrl} label="booking page link" />
          </div>
        </div>
      </SettingsSection>
    </SettingsStack>
  );
}
