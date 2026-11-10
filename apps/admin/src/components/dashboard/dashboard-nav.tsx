"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ClipboardList,
  CreditCard,
  Inbox,
  LayoutDashboard,
  MapPin,
  Package,
  Settings,
  Star,
  Users,
  UsersRound,
  Wrench,
} from "lucide-react";
import { can, type Permission, type Role } from "@leadgen/core/team/access";
import { cn } from "@/lib/utils";
import { appPathOf, appUrl } from "@/lib/urls";

export type NavItem = { href: string; label: string; icon: typeof Settings; permission?: Permission };

// Each item shows only to the access levels that can use it (team/access.ts).
// Labels match the title of the page they open.
const sections: { title?: string; items: NavItem[] }[] = [
  {
    title: "Day to day",
    items: [
      { href: "", label: "Overview", icon: LayoutDashboard },
      { href: "/diary", label: "Diary", icon: CalendarDays, permission: "diary.view" },
      { href: "/bookings", label: "Bookings", icon: ClipboardList, permission: "diary.view" },
      { href: "/leads", label: "Leads", icon: Inbox, permission: "leads.view" },
      { href: "/customers", label: "Customers", icon: Users, permission: "customers.view" },
      { href: "/reviews", label: "Reviews", icon: Star, permission: "customers.view" },
    ],
  },
  {
    title: "Your business",
    items: [
      { href: "/pricing", label: "Pricing", icon: Package, permission: "pricing.view" },
      { href: "/coverage", label: "Coverage area", icon: MapPin, permission: "settings.view" },
      { href: "/team", label: "Team", icon: UsersRound, permission: "settings.view" },
      { href: "/payments", label: "Payments", icon: CreditCard, permission: "money" },
    ],
  },
  {
    items: [
      { href: "/settings", label: "Settings", icon: Settings },
      { href: "/setup", label: "Setup", icon: Wrench, permission: "setup" },
    ],
  },
];

// What this person sees. Setup goes once it's finished, and comes back by
// itself if something it needs is undone.
export function navSections(role: Role, setupDone: boolean) {
  return sections
    .map((section) => ({
      ...section,
      items: section.items
        .filter((i) => (!i.permission || can(role, i.permission)) && !(i.href === "/setup" && setupDone))
        // Technicians only have their own account under Settings.
        .map((i) => (i.href === "/settings" && !can(role, "settings.view") ? { ...i, href: "/settings/account" } : i)),
    }))
    .filter((section) => section.items.length > 0);
}

// `here` and `base` are dashboard paths (/ascnd/bookings), whatever form the address bar is in.
export function isActive(here: string, base: string, href: string) {
  return href === "" ? here === base : here.startsWith(base + href);
}

// The sidebar, on anything wider than a phone (phones get DashboardTabs).
export function DashboardNav({ slug, role, setupDone }: { slug: string; role: Role; setupDone: boolean }) {
  const here = appPathOf(usePathname());
  const base = `/${slug}`;

  return (
    <nav aria-label="Main" className="flex flex-col gap-5">
      {navSections(role, setupDone).map((section) => (
        <div key={section.items[0].href} className="flex flex-col gap-1">
          {section.title && (
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">{section.title}</p>
          )}
          {section.items.map(({ href, label, icon: Icon }) => {
            const active = isActive(here, base, href);
            return (
              <Link
                key={label}
                href={appUrl(base + href)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  active && "bg-nav-active text-nav-active-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
