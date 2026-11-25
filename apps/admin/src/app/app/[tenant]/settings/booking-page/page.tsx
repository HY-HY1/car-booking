import type { Metadata } from "next";
import { connection } from "next/server";
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
import { AboutForm, GalleryForm } from "@/components/dashboard/settings/about-forms";
import { FaqForm } from "@/components/dashboard/settings/faq-form";
import { ExtrasForm } from "@/components/dashboard/settings/extras-form";
import { policySummary } from "@leadgen/core/branding/extras";
import { depositSchema } from "@leadgen/core/booking/config";
import { policyOf } from "@leadgen/core/settings/policy";
import { addDomainAction, saveAboutAction, saveBrandingAction, saveExtrasAction, saveFaqsAction, saveGalleryAction, saveHomePageAction } from "../actions";

export const metadata: Metadata = { title: "Booking page" };

export default async function BookingPageSettings({ params }: PageProps<"/app/[tenant]/settings/booking-page">) {
  // Per signed-in user, and the question and testimonial editors make row
  // ids as they first draw, so render at request time.
  await connection();
  const { tenant: slug } = await params;
  const { tenant, can } = await requireAccess(slug, "settings.view");
  const readOnly = !can("settings.edit");

  const supabase = await createClient();
  const [business, domains, services, shortest, booking, completed] = await Promise.all([
    supabase.from("tenants").select("name, branding").eq("id", tenant.id).single(),
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
    supabase.from("booking_settings").select("offers_mobile, deposit, cancellation_policy").eq("tenant_id", tenant.id).maybeSingle(),
    // For the jobs completed count.
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id).eq("status", "completed"),
  ]);
  if (business.error) throw business.error;
  if (domains.error) throw domains.error;
  if (services.error) throw services.error;
  if (shortest.error) throw shortest.error;
  if (booking.error) throw booking.error;
  if (completed.error) throw completed.error;
  // The deposit and cancellation line as the booking page makes it.
  const deposit = depositSchema.safeParse(booking.data?.deposit);
  const automaticLine = deposit.success ? policySummary(deposit.data, policyOf(booking.data?.cancellation_policy)) : null;

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
          contact={{ email: branding.page_email ?? null, phone: branding.page_phone ?? null }}
          services={services.data.map((s) => ({
            id: s.id,
            name: s.name,
            basePricePence: s.base_price_pence,
            tagline: s.tagline,
            imageUrl: serviceImageUrl(s.image_path),
          }))}
          facts={branding.about.facts}
          showPhone={branding.home.show_phone}
          action={saveBrandingAction.bind(null, slug)}
          readOnly={readOnly}
        />
      </SettingsSection>

      <SettingsSection
        id="about"
        title="About you"
        description="What makes the page yours: why customers choose you, and who they'll be dealing with."
      >
        <AboutForm
          about={branding.about}
          businessName={business.data.name}
          action={saveAboutAction.bind(null, slug)}
          readOnly={readOnly}
        />
      </SettingsSection>

      <SettingsSection
        id="photos"
        title="Photos of your work"
        description="Your first three show on your home page; customers see the rest, in this order, with See all. Tapping one shows it bigger."
      >
        <GalleryForm
          key={branding.gallery.map((p) => p.url).join("|")}
          photos={branding.gallery}
          action={saveGalleryAction.bind(null, slug)}
          readOnly={readOnly}
        />
      </SettingsSection>

      <SettingsSection
        id="faqs"
        title="Questions and answers"
        description="Answers to what customers often ask, shown on your home page in this order. Fewer calls asking the same things."
      >
        {/* Remounted after a save, so blank rows go and the text shows as saved. */}
        <FaqForm key={JSON.stringify(branding.faqs)} faqs={branding.faqs} action={saveFaqsAction.bind(null, slug)} readOnly={readOnly} />
      </SettingsSection>

      <SettingsSection
        id="home"
        title="Home page"
        description="What your booking page's home shows: sections made from your diary and coverage, and your phone number."
      >
        <HomePageForm
          home={branding.home}
          shortestMins={shortest.data?.duration_mins ?? null}
          travels={Boolean(booking.data?.offers_mobile)}
          hasPhone={Boolean(branding.page_phone)}
          action={saveHomePageAction.bind(null, slug)}
          readOnly={readOnly}
        />
      </SettingsSection>

      <SettingsSection
        id="trust"
        title="Trust and enquiries"
        description="Small things that help customers decide: your terms by the booking buttons, how many jobs you've done, and a way to ask about anything else."
      >
        <ExtrasForm
          extras={branding.extras}
          automaticLine={automaticLine}
          completed={completed.count ?? 0}
          enquiryUrl={tenantUrl(slug, "/contact", { absolute: true, customDomain })}
          action={saveExtrasAction.bind(null, slug)}
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
