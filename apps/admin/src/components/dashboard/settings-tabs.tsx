"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { can, type Permission, type Role } from "@leadgen/core/team/access";
import { cn } from "@/lib/utils";
import { appPathOf, appUrl } from "@/lib/urls";

// One row of tabs; scrolls sideways on a phone rather than wrapping. Each
// access level only sees the tabs it can open.
export function SettingsTabs({ slug, role }: { slug: string; role: Role }) {
  // Compared as dashboard paths (/ascnd/settings), whatever form the address bar is in.
  const here = appPathOf(usePathname());
  const base = `/${slug}/settings`;
  const view: Permission = "settings.view";
  const tabs: { path: string; label: string; permission?: Permission }[] = [
    { path: `${base}/account`, label: "Account" },
    { path: base, label: "General", permission: view },
    { path: `${base}/booking-page`, label: "Booking page", permission: view },
    { path: `${base}/booking`, label: "Booking", permission: view },
    { path: `${base}/assistant`, label: "AI assistant", permission: view },
    { path: `${base}/payments`, label: "Payments", permission: view },
    { path: `${base}/notifications`, label: "Notifications", permission: view },
    { path: `${base}/privacy`, label: "Privacy & data", permission: view },
    { path: `${base}/team`, label: "Team & access", permission: view },
    { path: `${base}/billing`, label: "Billing", permission: view },
    { path: `${base}/integrations`, label: "Integrations", permission: "api" },
  ];

  return (
    <nav aria-label="Settings" className="-mx-4 mb-6 overflow-x-auto px-4 md:mx-0 md:px-0">
      <div className="flex w-max gap-1 border-b pb-2 md:w-auto md:flex-wrap">
        {tabs.filter((t) => !t.permission || can(role, t.permission)).map((t) => {
          const active = t.path === base ? here === base : here === t.path || here.startsWith(`${t.path}/`);
          return (
            <Link
              key={t.path}
              href={appUrl(t.path)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap text-muted-foreground hover:bg-muted",
                active && "bg-muted text-foreground",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
