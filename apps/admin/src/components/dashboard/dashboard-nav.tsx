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
  Users,
  UsersRound,
  Wrench,
} from "lucide-react";
import { can, type Permission, type Role } from "@leadgen/core/team/access";
import { cn } from "@/lib/utils";
import { appPathOf, appUrl } from "@/lib/urls";

// Each item shows only to the access levels that can use it (team/access.ts).
const sections: {
  title: string;
  items: { href: string; label: string; icon: typeof Settings; permission?: Permission }[];
}[] = [
  {
    title: "Overview",
    items: [
      { href: "", label: "Dashboard", icon: LayoutDashboard },
      { href: "/diary", label: "Calendar", icon: CalendarDays, permission: "diary.view" },
      { href: "/bookings", label: "Bookings", icon: ClipboardList, permission: "diary.view" },
      { href: "/leads", label: "Leads", icon: Inbox, permission: "leads.view" },
    ],
  },
  {
    title: "Services",
    items: [
      { href: "/pricing", label: "Packages", icon: Package, permission: "pricing.view" },
      { href: "/coverage", label: "Coverage Area", icon: MapPin, permission: "settings.view" },
      { href: "/staff", label: "Staff / Techs", icon: UsersRound, permission: "settings.view" },
    ],
  },
  {
    title: "Marketing",
    items: [{ href: "/customers", label: "Customers", icon: Users, permission: "customers.view" }],
  },
  {
    title: "Finance",
    items: [{ href: "/payments", label: "Payments", icon: CreditCard, permission: "money" }],
  },
  {
    title: "Settings",
    items: [
      { href: "/settings", label: "Settings", icon: Settings },
      { href: "/setup", label: "Setup", icon: Wrench, permission: "setup" },
    ],
  },
];

export function DashboardNav({ slug, role }: { slug: string; role: Role }) {
  // Compared as dashboard paths (/ascnd/bookings), whatever form the address bar is in.
  const here = appPathOf(usePathname());
  const base = `/${slug}`;
  const shown = sections
    .map((section) => ({
      ...section,
      items: section.items
        .filter((i) => !i.permission || can(role, i.permission))
        // Technicians only have their own account under Settings.
        .map((i) => (i.href === "/settings" && !can(role, "settings.view") ? { ...i, href: "/settings/account" } : i)),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 md:flex-col md:gap-5 md:overflow-visible">
      {shown.map((section) => (
        <div key={section.title} className="flex gap-1 md:flex-col">
          <p className="hidden px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50 md:block">
            {section.title}
          </p>
          {section.items.map(({ href, label, icon: Icon }) => {
            const path = base + href;
            const active = href === "" ? here === base : here.startsWith(path);
            return (
              <Link
                key={label}
                href={appUrl(path)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  active && "bg-sidebar-accent text-sidebar-accent-foreground",
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
