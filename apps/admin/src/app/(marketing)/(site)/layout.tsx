import type { Metadata } from "next";
import { Big_Shoulders, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { PRODUCT_NAME } from "@/lib/brand";
import "./landing.css";

// The public site: home, features, pricing, about. Its look is a printed job
// sheet: oil black and paper, condensed display type, times and prices in
// mono, one hi-vis orange.

const display = Big_Shoulders({ subsets: ["latin"], axes: ["opsz"], variable: "--font-display" });
const body = IBM_Plex_Sans({ subsets: ["latin"], variable: "--font-body" });
const data = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-data" });

export const metadata: Metadata = {
  title: { default: PRODUCT_NAME, template: `%s · ${PRODUCT_NAME}` },
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`lp ${display.variable} ${body.variable} ${data.variable} flex min-h-dvh flex-col antialiased`}>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
