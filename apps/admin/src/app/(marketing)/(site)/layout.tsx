import type { Metadata } from "next";
import { SiteFooter } from "@/components/landing/site-footer";
import { landingFonts } from "@/components/landing/fonts";
import { SiteHeader } from "@/components/landing/site-header";
import { PRODUCT_NAME } from "@/lib/brand";
import "./landing.css";

// The public site: home, features, pricing, about. Its look is a printed job
// sheet: oil black and paper, condensed display type, times and prices in
// mono, one hi-vis orange.

export const metadata: Metadata = {
  title: { default: PRODUCT_NAME, template: `%s · ${PRODUCT_NAME}` },
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`lp ${landingFonts} flex min-h-dvh flex-col antialiased`}>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
