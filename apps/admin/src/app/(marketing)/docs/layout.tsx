import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { DocsNav, DocsPager } from "@/components/docs/docs-nav";
import { appUrl, docsUrl, marketingUrl } from "@/lib/urls";

// The public docs, under /docs on the marketing site. No sign-in. Pages link
// to each other with docsUrl("/api/keys"), which adds the /docs prefix.

export const metadata: Metadata = {
  // absolute: the root layout's "· Owner dashboard" template doesn't apply here.
  title: { absolute: "ASCND Docs", template: "%s · ASCND Docs" },
  description:
    "How the booking platform works, from setting up your services to taking deposits, and the API for showing your services and prices on your own website.",
};

export default function DocsLayout({ children }: LayoutProps<"/docs">) {

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href={docsUrl()} className="text-lg font-semibold tracking-tight">
            ASCND <span className="font-normal text-muted-foreground">Docs</span>
          </Link>
          <nav className="flex items-center gap-1">
            <a href={appUrl("/login")} className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Sign in
            </a>
            <a href={appUrl("/signup")} className={buttonVariants({ size: "sm" })}>
              Get started
            </a>
          </nav>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-4 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12">
        <aside className="pt-4 lg:sticky lg:top-14 lg:max-h-[calc(100dvh-3.5rem)] lg:self-start lg:overflow-y-auto lg:py-10">
          <DocsNav />
        </aside>
        <main className="min-w-0 py-8 lg:py-10">
          <article className="docs-prose max-w-3xl">{children}</article>
          <DocsPager />
        </main>
      </div>

      <footer className="border-t px-4 py-6 text-center text-sm text-muted-foreground">
        &copy; ASCND ·{" "}
        <a href={marketingUrl("/legal/terms")} className="underline underline-offset-2">
          Terms
        </a>{" "}
        ·{" "}
        <a href={marketingUrl("/legal/privacy")} className="underline underline-offset-2">
          Privacy
        </a>
      </footer>
    </div>
  );
}
