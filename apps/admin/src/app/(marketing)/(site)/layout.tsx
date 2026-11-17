import type { Metadata } from "next";
import { siteFont } from "@/components/landing/fonts";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { SITE_NAME } from "@/lib/brand";
import "./site.css";

// The public site. Header, footer and home page are being rebuilt from bare
// bones (site.css); the other pages keep the old look until they're redone
// (./(legacy)/layout.tsx).

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`site ${siteFont} flex min-h-dvh flex-col antialiased`}>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
