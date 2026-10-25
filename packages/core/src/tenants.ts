import "server-only";
import { z } from "zod";
import { createAdminClient } from "./supabase/admin";
import { hostnameOf, routingConfig } from "./urls";

// Which business a request is for. The booking app's proxy works out the
// slug from the URL (/booking/<slug>, <slug>.domain.com, or a verified custom
// domain looked up here) and hands it to the pages; this turns it into the
// business. Nothing else the visitor sends can choose the tenant.

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

// Where the booking page's "Back to website" link goes. http(s) only: it's
// rendered as a link, so a javascript: URL must never get through.
export const websiteUrlSchema = z.url().refine((v) => /^https?:\/\//i.test(v), "Use a web address starting with http:// or https://.");

// What an owner types → a full URL: "localhost:4321" gets http://, anything
// else without a scheme gets https://. Blank means no link.
export function normalizeWebsiteUrl(input: string) {
  const v = input.trim();
  if (!v) return "";
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) return v;
  return /^localhost(:\d+)?(\/|$)/i.test(v) ? `http://${v}` : `https://${v}`;
}

export const brandingSchema = z.object({
  website_url: websiteUrlSchema.optional().catch(undefined),
  primary_color: hexColor.catch("#18181b"),
  accent_color: hexColor.catch("#3b82f6"),
  logo_url: z.url().optional().catch(undefined),
  // Behind the heading on the booking page's home.
  cover_url: z.url().optional().catch(undefined),
  tagline: z.string().optional().catch(undefined),
  // The floating button the embed script adds to the owner's website.
  button_label: z.string().min(1).max(30).optional().catch(undefined),
  button_position: z.enum(["right", "left"]).catch("right"),
});
export type Branding = z.infer<typeof brandingSchema>;

export type PublicTenant = {
  id: string;
  name: string;
  slug: string;
  // Its verified primary custom domain (booking.theirsite.com), if it has
  // one: where its booking pages live in subdomain mode.
  customDomain: string | null;
  branding: Branding;
  trackingIds: Record<string, string>;
  // How customers reach the business (Settings → General).
  contact: { email: string | null; phone: string | null };
  // Who's responsible for customers' data, for the privacy notice.
  privacy: {
    legalName: string | null;
    contactEmail: string | null;
    icoRegistration: string | null;
    retentionMonths: number;
    // The business's own policy, linked instead of the generated notice.
    policyUrl: string | null;
    // The marketing tick box's wording; null = the default.
    marketingConsentText: string | null;
  };
};

// A hostname that's one of ours rather than a business's own domain: the
// root domain and its subdomains, and *.localhost (the slug.localhost rows
// made before slug routing). These never count as custom domains.
export function isCustomHostname(hostname: string) {
  const h = hostnameOf(hostname);
  const root = hostnameOf(routingConfig().rootDomain);
  return Boolean(h) && h !== "localhost" && !h.endsWith(".localhost") && h !== root && !h.endsWith(`.${root}`);
}

type DomainRow = { hostname: string; verified: boolean; is_primary: boolean };

// The verified custom domain customers should be sent to: the primary one.
function primaryCustom(rows: DomainRow[] | null | undefined) {
  return rows?.find((d) => d.verified && d.is_primary && isCustomHostname(d.hostname))?.hostname ?? null;
}

export async function getTenantBySlug(slug: string): Promise<PublicTenant | null> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;

  const { data, error } = await createAdminClient()
    .from("tenants")
    .select(
      "id, name, slug, branding, tracking_ids, contact_email, contact_phone, legal_name, privacy_email, ico_registration, retention_months, privacy_policy_url, marketing_consent_text, domains(hostname, verified, is_primary)",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  const tenant = data as unknown as {
    id: string;
    name: string;
    slug: string;
    branding: unknown;
    tracking_ids: Record<string, string> | null;
    contact_email: string | null;
    contact_phone: string | null;
    legal_name: string | null;
    privacy_email: string | null;
    ico_registration: string | null;
    retention_months: number;
    privacy_policy_url: string | null;
    marketing_consent_text: string | null;
    domains: DomainRow[] | null;
  } | null;
  if (!tenant) return null;

  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    customDomain: primaryCustom(tenant.domains),
    branding: brandingSchema.parse(tenant.branding ?? {}),
    trackingIds: tenant.tracking_ids ?? {},
    contact: { email: tenant.contact_email, phone: tenant.contact_phone },
    privacy: {
      legalName: tenant.legal_name,
      contactEmail: tenant.privacy_email,
      icoRegistration: tenant.ico_registration,
      retentionMonths: tenant.retention_months,
      policyUrl: tenant.privacy_policy_url,
      marketingConsentText: tenant.marketing_consent_text,
    },
  };
}

// A business's verified primary custom domain, by slug or id: what
// tenantUrl() needs to link to its booking pages in subdomain mode.
export async function getCustomDomain(tenant: { slug: string } | { id: string }) {
  const query = createAdminClient().from("tenants").select("domains(hostname, verified, is_primary)");
  const { data, error } = await ("slug" in tenant ? query.eq("slug", tenant.slug) : query.eq("id", tenant.id)).maybeSingle();
  if (error) throw error;
  return primaryCustom((data as { domains: DomainRow[] | null } | null)?.domains);
}

// A verified custom domain → the slug of the business it belongs to. Used by
// the booking app's proxy (which caches it) in subdomain mode.
export async function slugForCustomDomain(hostname: string) {
  const h = hostnameOf(hostname);
  if (!isCustomHostname(h)) return null;
  const { data, error } = await createAdminClient()
    .from("domains")
    .select("tenant:tenants(slug)")
    .eq("hostname", h)
    .eq("verified", true)
    .maybeSingle();
  if (error) throw error;
  return (data?.tenant as unknown as { slug: string } | null)?.slug ?? null;
}
