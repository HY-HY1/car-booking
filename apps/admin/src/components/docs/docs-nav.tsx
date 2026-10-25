"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronDown } from "lucide-react";
import { DOCS_NAV, DOCS_PAGES, docsPath } from "@/lib/docs-nav";
import { cn } from "@/lib/utils";
import { docsUrl } from "@/lib/urls";

function NavList({ current }: { current: string }) {
  return (
    <div className="grid gap-6">
      {DOCS_NAV.map((section) => (
        <div key={section.title}>
          <p className="mb-1.5 px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {section.title}
          </p>
          <ul className="grid gap-0.5">
            {section.pages.map((page) => {
              const active = page.href === current;
              return (
                <li key={page.href}>
                  <Link
                    href={docsUrl(page.href)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block rounded-md px-2 py-1.5 text-sm transition-colors",
                      active ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    {page.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

// Sidebar on wide screens; a collapsible menu above the page on phones, which
// closes again after following a link (it remounts when the page changes).
export function DocsNav() {
  const current = docsPath(usePathname());
  const title = DOCS_PAGES.find((p) => p.href === current)?.title ?? "Menu";

  return (
    <nav aria-label="Docs">
      <details key={current} className="group rounded-lg border lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-sm font-medium">
          {title}
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="border-t p-2">
          <NavList current={current} />
        </div>
      </details>
      <div className="hidden lg:block">
        <NavList current={current} />
      </div>
    </nav>
  );
}

export function DocsPager() {
  const current = docsPath(usePathname());
  const i = DOCS_PAGES.findIndex((p) => p.href === current);
  if (i === -1) return null;
  const prev = DOCS_PAGES[i - 1];
  const next = DOCS_PAGES[i + 1];

  const card = "grid gap-0.5 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50";
  return (
    <nav aria-label="Previous and next page" className="mt-14 grid max-w-3xl gap-3 border-t pt-6 sm:grid-cols-2">
      {prev ? (
        <Link href={docsUrl(prev.href)} className={card}>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <ArrowLeft className="size-3" aria-hidden /> Previous
          </span>
          <span className="font-medium">{prev.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link href={docsUrl(next.href)} className={cn(card, "sm:text-right")}>
          <span className="flex items-center gap-1 text-xs text-muted-foreground sm:justify-end">
            Next <ArrowRight className="size-3" aria-hidden />
          </span>
          <span className="font-medium">{next.title}</span>
        </Link>
      )}
    </nav>
  );
}
