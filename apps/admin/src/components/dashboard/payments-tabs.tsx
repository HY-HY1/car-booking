"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { appPathOf, appUrl } from "@/lib/urls";

export function PaymentsTabs({ slug }: { slug: string }) {
  // Compared as dashboard paths (/ascnd/payments), whatever form the address bar is in.
  const here = appPathOf(usePathname());
  const base = `/${slug}/payments`;
  const tabs = [
    { path: base, label: "Payments" },
    { path: `${base}/links`, label: "Payment links" },
  ];

  return (
    <nav className="mb-4 flex gap-1">
      {tabs.map((t) => {
        const active = t.path === base ? here === base : here.startsWith(t.path);
        return (
          <Link
            key={t.path}
            href={appUrl(t.path)}
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
