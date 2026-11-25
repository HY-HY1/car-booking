import "server-only";
import type { Metadata } from "next";
import { seoDefaults } from "@leadgen/core/branding/seo";
import type { PublicTenant } from "@leadgen/core/tenants";
import { loadBookingConfig } from "./booking-config";
import { pageUrl } from "./urls";

// How each page of a business's booking site shows up in search results and
// when its link is shared: the title and description the owner set (Settings
// → Booking page → Search and sharing) or ones made from what the business
// does and where, one canonical address (its own domain once it has one), and
// a sharing picture. Every page builds its metadata through pageMetadata, so
// they all agree.

type Tenant = Pick<PublicTenant, "id" | "name" | "slug" | "trade" | "customDomain" | "branding">;

export async function siteSeo(tenant: Tenant) {
  // Shared with the page (cached per request); never fails the page.
  const config = await loadBookingConfig(tenant.id).catch(() => null);
  const settings = config?.settings;
  const defaults = seoDefaults({
    name: tenant.name,
    trade: tenant.trade,
    mobile: Boolean(settings?.offers_mobile),
    unit: Boolean(settings?.offers_unit),
    places: settings?.offers_mobile ? tenant.branding.home.places : [],
    tagline: tenant.branding.tagline,
  });
  const { seo } = tenant.branding;
  return {
    title: seo.title ?? defaults.title,
    description: seo.description ?? defaults.description,
    image: seo.share_image_url ?? tenant.branding.cover_url ?? tenant.branding.logo_url ?? null,
  };
}

// A page's metadata. With no title it's the home page, which takes the site's
// title as it is; other pages are "<title> · <business>".
export async function pageMetadata(
  tenant: Tenant,
  path: string,
  page: { title?: string; description?: string | null; image?: string | null; index?: boolean } = {},
): Promise<Metadata> {
  const site = await siteSeo(tenant);
  const url = pageUrl(tenant, path, { absolute: true });
  const title = page.title ? `${page.title} · ${tenant.name}` : site.title;
  const description = page.description?.trim() || site.description;
  const image = page.image ?? site.image;
  const images = image ? [image] : undefined;
  return {
    title: page.title ?? { absolute: site.title },
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", locale: "en_GB", siteName: tenant.name, url, title, description, images },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images },
    ...(page.index === false && { robots: { index: false, follow: false } }),
  };
}
