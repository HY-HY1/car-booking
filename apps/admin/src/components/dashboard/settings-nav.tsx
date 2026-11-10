"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { can, type Permission, type Role } from "@leadgen/core/team/access";
import { cn } from "@/lib/utils";
import { appPathOf, appUrl } from "@/lib/urls";

type Item = { path: string; label: string; permission?: Permission; soon?: boolean };

const view: Permission = "settings.view";
const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Business",
    items: [
      { path: "", label: "Business details", permission: view },
      { path: "/privacy", label: "Privacy & data", permission: view },
      { path: "/activity", label: "Activity log", permission: "activity.view" },
      { path: "/billing", label: "Billing", permission: view },
    ],
  },
  {
    title: "Bookings",
    items: [
      { path: "/booking", label: "Hours & rules", permission: view },
      { path: "/booking-page", label: "Booking page", permission: view },
      { path: "/payments", label: "Payments", permission: view },
      { path: "/notifications", label: "Notifications", permission: view },
    ],
  },
  {
    title: "Tools",
    items: [
      { path: "/integrations", label: "Integrations", permission: "settings.edit" },
      { path: "/assistant", label: "AI assistant", permission: view, soon: true },
    ],
  },
  { title: "You", items: [{ path: "/account", label: "Your account" }] },
];

// Settings in groups: down the side on a wide screen, and on anything
// narrower a button naming the current page that opens the same list. Each
// access level only sees what it can open.
export function SettingsNav({ slug, role }: { slug: string; role: Role }) {
  // Compared as dashboard paths (/ascnd/settings), whatever form the address bar is in.
  const here = appPathOf(usePathname());
  const base = `/${slug}/settings`;
  const isHere = (item: Item) =>
    item.path === "" ? here === base : here === base + item.path || here.startsWith(`${base}${item.path}/`);

  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => !i.permission || can(role, i.permission)) })).filter(
    (g) => g.items.length > 0,
  );
  const current = groups.flatMap((g) => g.items).find(isHere);

  const list = groups.map((group) => (
    <div key={group.title}>
      <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.title}</p>
      {group.items.map((item) => {
        const active = isHere(item);
        return (
          <Link
            key={item.path}
            href={appUrl(base + item.path)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center justify-between gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-muted lg:min-h-9",
              active && "bg-muted text-foreground",
            )}
          >
            {item.label}
            {item.soon && <span className="text-xs font-normal">Soon</span>}
          </Link>
        );
      })}
    </div>
  ));

  return (
    <nav aria-label="Settings" className="mb-6 lg:sticky lg:top-4 lg:mb-0">
      {/* Keyed so it's shut again on the next page. */}
      <details key={here} className="group rounded-lg border lg:hidden">
        <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 px-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
          {current?.label ?? "Choose a setting"}
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="grid gap-3 border-t p-2">{list}</div>
      </details>
      <div className="hidden gap-4 lg:grid">{list}</div>
    </nav>
  );
}
