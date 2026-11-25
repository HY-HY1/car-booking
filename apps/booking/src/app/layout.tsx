import type { Metadata } from "next";
import { defaultFontVariable } from "@/lib/fonts";
import { getRequestTenant } from "@/lib/tenant";
import { themeStyle } from "@/lib/theme";
import { THEME_SCRIPT } from "@/lib/theme-script";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getRequestTenant();
  if (!tenant) return { title: "Bookings" };
  return {
    title: { default: `Book with ${tenant.name}`, template: `%s · ${tenant.name}` },
    description: tenant.branding.tagline ?? `Check prices and book online with ${tenant.name}.`,
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
