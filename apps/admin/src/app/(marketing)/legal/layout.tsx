import Link from "next/link";
import { PLATFORM, TERMS_VERSION } from "@leadgen/core/privacy/platform";
import { marketingUrl } from "@/lib/urls";

// Public frame for ASCND's own legal pages (no sign-in needed, so they can be
// linked from the sign-up form and from emails).
export default function LegalLayout({ children }: LayoutProps<"/legal">) {
  return (
    <main className="flex-1 px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <nav className="mb-8 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <Link href={marketingUrl("/legal/terms")} className="underline">Terms of Service</Link>
          <Link href={marketingUrl("/legal/privacy")} className="underline">Privacy Policy</Link>
          <Link href={marketingUrl("/legal/dpa")} className="underline">Data Processing Terms</Link>
        </nav>
        <article className="[&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:mt-1 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mt-3 [&_p]:leading-relaxed [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </article>
        <p className="mt-12 text-xs text-muted-foreground">
          {PLATFORM.name}
          {PLATFORM.companyNumber && ` · Company no. ${PLATFORM.companyNumber}`}
          {PLATFORM.address && ` · ${PLATFORM.address}`}
          {PLATFORM.icoRegistration && ` · ICO ${PLATFORM.icoRegistration}`} · Version {TERMS_VERSION}
        </p>
      </div>
    </main>
  );
}
