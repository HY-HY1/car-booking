import { PLATFORM } from "@leadgen/core/privacy/platform";
import { appUrl, docsUrl, marketingUrl } from "@/lib/urls";
import { Logo, NAV } from "./site-header";

// Every page on the site is reachable from here, including the ones the
// header leaves out.
export function SiteFooter() {
  const docs = docsUrl();
  return (
    <footer className="border-t border-(--line) px-4 pt-14 pb-10 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-(--muted)">Booking software for mobile detailers and valeters.</p>
        </div>
        <FooterLinks
          title="Product"
          links={[...NAV, ...(docs ? ([["Docs", docs]] as const) : []), ["Sign in", appUrl("/login")]]}
        />
        <FooterLinks
          title="Company"
          links={[
            ["About", "/about"],
            ["Contact", "/contact"],
            ["Book a demo", "/contact?topic=demo"],
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
      <p className="mx-auto mt-14 max-w-6xl border-t border-(--line) pt-6 text-xs text-(--muted)">
        © {PLATFORM.name}
        {PLATFORM.companyNumber && ` · Company no. ${PLATFORM.companyNumber}`}
        {PLATFORM.address && ` · ${PLATFORM.address}`}
      </p>
    </footer>
  );
}

function FooterLinks({ title, links }: { title: string; links: readonly (readonly [string, string])[] }) {
  return (
    <div>
      <p className="text-sm font-medium">{title}</p>
      <ul className="mt-3 grid gap-2 text-sm text-(--muted)">
        {links.map(([label, href]) => (
          <li key={label}>
            <a href={href} className="hover:text-(--fg)">
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
