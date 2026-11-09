"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { appPathOf, appUrl } from "@/lib/urls";

// Tabs across the top of a page made of a few sub-pages. `path` is added to
// `base`; the first tab is `base` itself.
export function PageTabs({ base, tabs }: { base: string; tabs: { path: string; label: string }[] }) {
  // Compared as dashboard paths (/ascnd/payments), whatever form the address bar is in.
  const here = appPathOf(usePathname());

  return (
    <nav className="mb-4 flex gap-1">
      {tabs.map((t) => {
        const path = base + t.path;
        const active = t.path === "" ? here === base : here.startsWith(path);
        return (
          <Link
            key={t.path}
            href={appUrl(path)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted",
              active && "bg-muted text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
