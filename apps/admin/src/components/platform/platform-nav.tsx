"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// The platform admin's sections. Hrefs come from adminUrl(), which can be a
// full address on its own host (admin.domain.com) or a path under /admin, so
// only their path is compared with the page's.
export function PlatformNav({ links }: { links: { href: string; label: string; exact?: boolean }[] }) {
  const pathname = usePathname();
  const pathOf = (href: string) => new URL(href, "http://x").pathname.replace(/\/$/, "") || "/";

  return (
    <nav aria-label="Platform admin" className="-mx-1 flex gap-1 overflow-x-auto text-sm">
      {links.map((link) => {
        const path = pathOf(link.href);
        const active = link.exact ? pathname === path || pathname === `${path}/` : pathname === path || pathname.startsWith(`${path}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-2.5 py-1.5 whitespace-nowrap",
              active ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:text-sidebar-foreground",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
