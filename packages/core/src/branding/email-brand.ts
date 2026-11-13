import type { EmailBrand } from "../email/compose";

// A business's branding (tenants.branding) as its customer emails show it.
// The logo is the email copy (email_logo: a PNG made when the logo was saved,
// see email-logo.ts), since Outlook on Windows can't show WebP; a business
// that hasn't saved its branding since then gets its original logo, which
// every other client shows. Pure, so the Settings preview can use it too.

type StoredBranding = {
  logo_url?: unknown;
  email_logo?: unknown;
  primary_color?: unknown;
  accent_color?: unknown;
  tagline?: unknown;
  website_url?: unknown;
};

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export type EmailLogo = { url: string; width: number; height: number };

export function emailLogoOf(raw: unknown): EmailLogo | null {
  if (!raw || typeof raw !== "object") return null;
  const { url, width, height } = raw as Record<string, unknown>;
  return typeof url === "string" && typeof width === "number" && typeof height === "number" && width > 0 && height > 0
    ? { url, width, height }
    : null;
}

export function emailBrandOf(t: { name: string; contactEmail?: string | null; contactPhone?: string | null; branding: unknown }): EmailBrand {
  const b = (t.branding && typeof t.branding === "object" ? t.branding : {}) as StoredBranding;
  const original = str(b.logo_url);
  const copy = emailLogoOf(b.email_logo);
  return {
    name: t.name,
    logo: copy ?? (original ? { url: original } : null),
    primaryColor: str(b.primary_color),
    accentColor: str(b.accent_color),
    tagline: str(b.tagline),
    websiteUrl: str(b.website_url),
    contactEmail: t.contactEmail ?? null,
    contactPhone: t.contactPhone ?? null,
  };
}
