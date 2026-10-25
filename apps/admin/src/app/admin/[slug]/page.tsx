import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getBusinessBySlug } from "@leadgen/core/platform/businesses";
import { slugSchema } from "@leadgen/core/platform/rules";
import { isCustomHostname } from "@leadgen/core/tenants";
import { BackLink, PageHeader } from "@/components/dashboard/page-header";
import { CopyText } from "@/components/platform/copy-text";
import { DomainForm } from "@/components/platform/domain-form";
import { MemberForm } from "@/components/platform/member-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/platform";
import { makePrimaryAction, setVerifiedAction } from "./actions";
import { adminUrl, appUrl, tenantUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Business" };

const STRIPE = {
  connected: "Connected: customers can pay deposits online.",
  pending: "Started but not finished. The owner needs to continue under Settings → Payments.",
  none: "Not connected. Bookings are taken without a deposit step until the owner connects it under Settings → Payments.",
} as const;

export default function BusinessPage({ params }: PageProps<"/admin/[slug]">) {
  return (
    <>
      <BackLink href={adminUrl()}>Businesses</BackLink>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <Business params={params} />
      </Suspense>
    </>
  );
}

async function Business({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const admin = await requirePlatformAdmin(adminUrl(`/${slug}`));
  if (!slugSchema.safeParse(slug).success) notFound();
  const b = await getBusinessBySlug(slug);
  if (!b) notFound();

  // Its own domains; the free address (/booking/<slug>, <slug>.domain.com) isn't one.
  const domains = b.domains.filter((d) => isCustomHostname(d.hostname));
  const customDomain = domains.find((d) => d.isPrimary && d.verified)?.hostname ?? null;
  const bookingLink = tenantUrl(b.slug, "/", { absolute: true, customDomain });
  const isMember = b.members.some((m) => m.userId === admin.id);

  return (
    <>
      <PageHeader title={b.name} description={`Dashboard ID ${b.slug} · ${b.bookings} confirmed ${b.bookings === 1 ? "booking" : "bookings"}`} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {isMember ? (
          <Link href={appUrl(`/${b.slug}`)} className={buttonVariants()}>
            Open their dashboard
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">
            You&apos;re not on this business, so you can&apos;t open its dashboard. Add yourself below as an owner.
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Booking page</CardTitle>
            <CardDescription>Where customers book, and the script for the owner&apos;s own website.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <CopyText value={bookingLink} label="booking address" />
            <p className="text-xs text-muted-foreground">Add to their website, before the closing body tag:</p>
            <CopyText value={`<script src="${tenantUrl(b.slug, "/embed.js", { absolute: true, customDomain })}" async></script>`} label="embed script" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payments</CardTitle>
            <CardDescription>The owner connects their own Stripe account.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">{STRIPE[b.stripe]}</CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Own domains</CardTitle>
            <CardDescription>
              The booking page always works at its free address. A domain of their own takes over once it&apos;s
              verified and primary (on the platform&apos;s own domain only): check its DNS points at us, then mark it verified.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <ul className="divide-y rounded-lg border">
              {domains.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 text-sm">
                  <span className="font-mono">{d.hostname}</span>
                  <span className="text-xs text-muted-foreground">
                    {[d.isPrimary && "Primary", d.verified ? "Verified" : "Not verified"].filter(Boolean).join(" · ")}
                  </span>
                  <div className="ml-auto flex gap-2">
                    <form action={setVerifiedAction.bind(null, b.slug, d.id, !d.verified)}>
                      <Button type="submit" variant="outline" size="sm">
                        {d.verified ? "Mark unverified" : "Mark verified"}
                      </Button>
                    </form>
                    {!d.isPrimary && (
                      <form action={makePrimaryAction.bind(null, b.slug, d.id)}>
                        <Button type="submit" variant="ghost" size="sm">
                          Make primary
                        </Button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
              {domains.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">None.</li>}
            </ul>
            <DomainForm slug={b.slug} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>People</CardTitle>
            <CardDescription>Owners can change prices and settings; staff can use bookings, leads and customers.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <ul className="divide-y rounded-lg border">
              {b.members.map((m) => (
                <li key={m.userId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="truncate">{m.email}</span>
                  <span className="shrink-0 text-xs capitalize text-muted-foreground">{m.role}</span>
                </li>
              ))}
              {b.members.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">Nobody yet.</li>}
            </ul>
            <MemberForm slug={b.slug} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
