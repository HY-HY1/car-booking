import { PLATFORM } from "@leadgen/core/privacy/platform";
import { PRODUCT_NAME } from "@/lib/brand";
import { appUrl, docsUrl, marketingUrl } from "@/lib/urls";
import { Wordmark } from "./site-header";

export function SiteFooter() {
  const docs = docsUrl();
  return (
    <footer className="px-4 pt-14 pb-10 sm:px-6">
      <div className="mx-auto grid max-w-7xl gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_auto_auto_auto_auto] lg:gap-16">
        <div>
          <Wordmark />
          <p className="mt-4 max-w-xs text-sm text-(--mist)">
            Booking software for mobile detailers and valeters. Quotes, bookings and deposits on your own page.
          </p>
        </div>
        <FooterLinks
          title={PRODUCT_NAME}
          links={[
            ["Features", "/features"],
            ["How it works", "/how-it-works"],
            ["Pricing", "/pricing"],
            ["About", "/about"],
            ...(docs ? ([["Docs", docs]] as [string, string][]) : []),
          ]}
        />
        <FooterLinks
          title="Account"
          links={[
            ["Sign in", appUrl("/login")],
            ["Start free trial", appUrl("/signup")],
          ]}
        />
        <FooterLinks
          title="Contact"
          links={[
            ["Send a message", "/contact"],
            ["Book a live demo", "/contact?topic=demo"],
          ]}
        />
        <FooterLinks
          title="Legal"
          links={[
            ["Privacy", marketingUrl("/legal/privacy")],
            ["Terms", marketingUrl("/legal/terms")],
            ["Data processing", marketingUrl("/legal/dpa")],
          ]}
        />
      </div>
      <p className="lp-data mx-auto mt-14 max-w-7xl border-t border-(--rule-dark) pt-6 text-xs text-(--mist)">
        © {PLATFORM.name}
        {PLATFORM.companyNumber && ` · Company no. ${PLATFORM.companyNumber}`}
        {PLATFORM.address && ` · ${PLATFORM.address}`}
      </p>
    </footer>
  );
}

function FooterLinks({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="lp-data text-[11px] tracking-[0.18em] text-(--mist) uppercase">{title}</p>
      <ul className="mt-3 grid gap-2 text-sm">
        {links.map(([label, href]) => (
          <li key={label}>
            <a href={href} className="hover:text-(--hi)">
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
