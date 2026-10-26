import type { Metadata } from "next";
import { dnsRecords } from "@leadgen/core/settings/domains";
import { brandingSchema, isCustomHostname } from "@leadgen/core/tenants";
import { AddDomainForm, BrandingForm, DomainRow, type DomainView } from "@/components/dashboard/settings/general-forms";
import { CopyText } from "@/components/platform/copy-text";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { tenantUrl } from "@/lib/urls";
import { addDomainAction, saveBrandingAction } from "../actions";

export const metadata: Metadata = { title: "Booking page" };

export default async function BookingPageSettings({ params }: PageProps<"/app/[tenant]/settings/booking-page">) {
  const { tenant: slug } = await params;
  const { tenant, can } = await requireAccess(slug, "settings.view");
  const readOnly = !can("settings.edit");

  const supabase = await createClient();
  const [business, domains] = await Promise.all([
    supabase.from("tenants").select("name, branding").eq("id", tenant.id).single(),
    supabase
      .from("domains")
      .select("id, hostname, verified, is_primary, verification_token, check_error, created_at")
      .eq("tenant_id", tenant.id)
      .order("is_primary", { ascending: false })
      .order("created_at"),
  ]);
  if (business.error) throw business.error;
  if (domains.error) throw domains.error;

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
    <div className="grid max-w-3xl gap-4">
      {readOnly && (
        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">Your access level lets you see these but not change them.</p>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Look and feel</CardTitle>
          <CardDescription>Your colours, logo and cover image on the booking page and the button on your website.</CardDescription>
        </CardHeader>
        <CardContent>
          <BrandingForm
            branding={branding}
            businessName={business.data.name}
            action={saveBrandingAction.bind(null, slug)}
            readOnly={readOnly}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Web address</CardTitle>
          <CardDescription>
            Your booking page always works at its free address. Add your own, like book.yourbusiness.co.uk, to use your
            domain instead.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ul className="grid gap-3">
            {views.map((d) => (
              <DomainRow key={d.id} slug={slug} domain={d} readOnly={readOnly} />
            ))}
          </ul>
          {custom.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Once its DNS checks out, make it your main address. We also connect it on our side, which can take up to
              a day; until then customers use the free address.
            </p>
          )}
          {!readOnly && <AddDomainForm action={addDomainAction.bind(null, slug)} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add booking to your website</CardTitle>
          <CardDescription>
            Paste this just before <code>&lt;/body&gt;</code> on your website. It adds the button above, which opens your
            booking form in a panel without leaving your site.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <CopyText value={`<script src="${tenantUrl(slug, "/embed.js", { absolute: true, customDomain })}" async></script>`} label="website script" />
          <p className="text-muted-foreground">
            Any link or button with <code>data-instant-quote</code> opens it too. Give it a service&apos;s link name, like{" "}
            <code>data-instant-quote=&quot;full-valet&quot;</code>, to start on that service.
          </p>
          <p className="text-muted-foreground">Or link straight to your booking page:</p>
          <CopyText value={liveUrl} label="booking page link" />
        </CardContent>
      </Card>
    </div>
  );
}
