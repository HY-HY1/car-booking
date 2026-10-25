import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { getRequestTenant } from "@/lib/tenant";
import { themeStyle } from "@/lib/theme";
import { pageUrl } from "@/lib/urls";
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
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body
        className="flex min-h-full flex-col font-sans"
        style={tenant ? themeStyle(tenant.branding) : undefined}
      >
        {children}
        {tenant && (
          <footer className="px-4 py-6 text-center text-xs text-neutral-500">
            <a href={pageUrl(tenant, "/privacy")} className="underline">Privacy notice</a>
            <span aria-hidden> · </span>
            <a href={pageUrl(tenant, "/privacy/request")} className="underline">Your data rights</a>
          </footer>
        )}
      </body>
    </html>
  );
}
