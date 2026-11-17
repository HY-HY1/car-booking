import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { getRequestTenant } from "@/lib/tenant";
import { themeStyle } from "@/lib/theme";
import { THEME_SCRIPT } from "@/lib/theme-script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getRequestTenant();
  if (!tenant) return { title: "Bookings" };
  return {
    title: { default: `Book with ${tenant.name}`, template: `%s · ${tenant.name}` },
    description: tenant.branding.tagline ?? `Get an instant quote and book with ${tenant.name}.`,
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const tenant = await getRequestTenant();
  return (
    // The theme script may add "dark" to <html> before React loads.
    <html lang="en" className={`${geistSans.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body
        className="flex min-h-full flex-col font-sans"
        style={tenant ? themeStyle(tenant.branding) : undefined}
      >
        {/* Each page draws its own header and footer (components/site.tsx),
            as pages inside the embed panel leave them out. */}
        {children}
      </body>
    </html>
  );
}
