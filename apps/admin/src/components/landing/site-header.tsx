import Image from "next/image";
import Link from "next/link";
import { SITE_NAME } from "@/lib/brand";
// White lettering for the dark site; site-logo.png is the original.
import logo from "./site-logo-light.png";
import { appUrl } from "@/lib/urls";
import { NavLink } from "./nav-link";

// Only the pages someone deciding whether to sign up needs. About, Contact,
// Docs and the legal pages live in the footer.
export const NAV = [
  ["Features", "/features"],
  ["How it works", "/how-it-works"],
  ["Pricing", "/pricing"],
] as const;

// The ASCND logo, standing in until the new brand has its own mark. Swap
// site-logo.png (and SITE_NAME in lib/brand.ts) when it does.
export function Logo({ className = "h-6" }: { className?: string }) {
  return <Image src={logo} alt={SITE_NAME} sizes="12rem" priority className={`w-auto ${className}`} />;
}

// The marketing pages' header: logo, three page links, sign in, and the one
// call to action. Below md the page links and sign in fold into a menu that
// works without JavaScript.
export function SiteHeader() {
  const signIn = appUrl("/login");
  return (
    <header className="sticky top-0 z-30 border-b border-(--line) bg-(--bg)/90 backdrop-blur">
      <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <Link href="/" aria-label={`${SITE_NAME} home`}>
          <Logo className="h-5 sm:h-6" />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-8 text-sm md:flex">
          {NAV.map(([label, href]) => (
            <NavLink key={href} href={href}>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2 text-sm">
          <Link href={signIn} className="hidden px-3 py-2 text-(--muted) hover:text-(--fg) md:block">
            Sign in
          </Link>
          <Link href={appUrl("/signup")} className="site-cta rounded-full px-4 py-2 font-medium">
            Start free trial
          </Link>

          <details className="group md:hidden">
            <summary className="cursor-pointer list-none rounded-md px-3 py-2 text-(--fg) [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">Menu</span>
              <span className="hidden group-open:inline">Close</span>
            </summary>
            <nav aria-label="Main" className="absolute inset-x-0 top-16 border-b border-(--line) bg-(--bg) px-4 pb-4 sm:px-6">
              <ul>
                {[...NAV, ["Sign in", signIn] as const].map(([label, href]) => (
                  <li key={label} className="border-b border-(--line) last:border-0">
                    <a href={href} className="block py-3 text-base">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
