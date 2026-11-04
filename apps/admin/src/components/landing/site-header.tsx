import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/brand";
import { appUrl, docsUrl } from "@/lib/urls";
import { NavLink } from "./nav-link";

const PAGES = [
  ["Features", "/features"],
  ["How it works", "/how-it-works"],
  ["Pricing", "/pricing"],
  ["About", "/about"],
  ["Contact", "/contact"],
] as const;

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`lp-display flex items-center gap-2 text-2xl ${className}`}>
      <span aria-hidden className="size-2.5 bg-(--hi)" />
      {PRODUCT_NAME}
    </span>
  );
}

// The marketing pages' header. Below desktop width the page links fold into
// a menu that works without JavaScript.
export function SiteHeader() {
  const docs = docsUrl();
  return (
    <header className="relative z-20 border-b border-(--rule-dark)">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label={`${PRODUCT_NAME} home`}>
          <Wordmark />
        </Link>

        <nav aria-label="Main" className="flex items-center gap-1 text-sm sm:gap-2">
          {PAGES.map(([label, href]) => (
            <NavLink key={href} href={href} className="hidden px-2.5 py-2 whitespace-nowrap lg:block">
              {label}
            </NavLink>
          ))}
          {docs && (
            <a href={docs} className="hidden px-2.5 py-2 text-(--mist) hover:text-(--paper) xl:block">
              Docs
            </a>
          )}
          <Link href={appUrl("/login")} className="hidden px-3 py-2 text-(--mist) hover:text-(--paper) sm:block">
            Sign in
          </Link>
          <Link href={appUrl("/signup")} className="bg-(--paper) px-4 py-2 font-semibold text-(--ink) hover:bg-white">
            <span className="sm:hidden">Free trial</span>
            <span className="hidden sm:inline">Start free trial</span>
          </Link>

          <details className="group lg:hidden">
            <summary className="lp-data ml-1 cursor-pointer list-none px-3 py-2 text-xs tracking-[0.14em] text-(--paper) uppercase [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">Menu</span>
              <span className="hidden group-open:inline">Close</span>
            </summary>
            <div className="absolute inset-x-0 top-16 border-b border-(--rule-dark) bg-(--ink) px-4 pb-6 sm:px-6">
              <ul className="grid">
                {[...PAGES, ...(docs ? ([["Docs", docs]] as const) : []), ["Sign in", appUrl("/login")] as const].map(([label, href]) => (
                  <li key={label} className="border-b border-(--rule-dark)">
                    <a href={href} className="lp-display block py-4 text-3xl hover:text-(--hi)">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        </nav>
      </div>
    </header>
  );
}
