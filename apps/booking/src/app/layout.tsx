import type { Metadata } from "next";
import { defaultFontVariable } from "@/lib/fonts";
import { siteSeo } from "@/lib/seo";
import { getRequestTenant } from "@/lib/tenant";
import { pageUrl } from "@/lib/urls";
import { themeStyle } from "@/lib/theme";
import { THEME_SCRIPT } from "@/lib/theme-script";
import "./globals.css";

// What every page of a business's site starts from (each page adds its own
// title, canonical address and sharing preview through lib/seo.ts): the
// description, the tab icon, Google's verification tag, and whether search
// engines may list it at all (Settings → Booking page → Search and sharing).
export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getRequestTenant();
  if (!tenant) return { title: "Bookings" };
  const site = await siteSeo(tenant);
  const { seo } = tenant.branding;
  // Their own icon (cropped square), or one made from the logo or their
  // initial, at each size browsers ask for (sites/[tenant]/tab-icon). The
  // upload's address in the query, so a new one isn't hidden by a cached copy.
  const version = seo.icon_url ? `&v=${encodeURIComponent(seo.icon_url.split("/").pop() ?? "")}` : "";
  const icon = (size: number) => ({ url: pageUrl(tenant, `/tab-icon?size=${size}${version}`), sizes: `${size}x${size}`, type: "image/png" });
  return {
    metadataBase: new URL(pageUrl(tenant, "/", { absolute: true })),
    title: { default: site.title, template: `%s · ${tenant.name}` },
    description: site.description,
    icons: { icon: [icon(32), icon(48), icon(192)], apple: [icon(180)] },
    ...(seo.google_verification && { verification: { google: seo.google_verification } }),
    ...(seo.hidden && { robots: { index: false, follow: false } }),
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const tenant = await getRequestTenant();
  const theme = tenant ? themeStyle(tenant.branding) : undefined;
  return (
    // The theme script may add "dark" to <html> before React loads.
    <html lang="en" className={`${defaultFontVariable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body
        className="flex min-h-full flex-col font-sans"
        style={theme}
        // Dark mode deepens a light brand's header, so the logo gets a backing (globals.css).
        data-logo-backing={theme && "--logo-backing-dark" in theme ? "" : undefined}
      >
        {/* Each page draws its own header and footer (components/site.tsx),
            as pages inside the embed panel leave them out. */}
        {children}
      </body>
    </html>
  );
}
