"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { can, type Permission, type Role } from "@leadgen/core/team/access";
import { cn } from "@/lib/utils";
import { appPathOf, appUrl } from "@/lib/urls";

type Item = { path: string; label: string; description: string; permission?: Permission; soon?: boolean };

const view: Permission = "settings.view";
const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Business",
    items: [
      {
        path: "",
        label: "Business details",
        description: "Your business's name, how customers reach you, and your time zone.",
        permission: view,
      },
      {
        path: "/privacy",
        label: "Privacy & data",
        description: "Your privacy notice, how long customers' details are kept, and requests about their data.",
        permission: view,
      },
      {
        path: "/activity",
        label: "Activity log",
        description: "Who changed what in your dashboard, newest first.",
        permission: "activity.view",
      },
      { path: "/billing", label: "Billing", description: "Your plan for using this software.", permission: "billing" },
    ],
  },
  {
    title: "Bookings",
    items: [
      {
        path: "/booking",
        label: "Hours & rules",
        description: "Where and when you work, how many jobs you can take at once, and the rules for booking.",
        permission: view,
      },
      {
        path: "/booking-page",
        label: "Booking page",
        description: "How your booking page looks, its web address, and adding it to your own website.",
        permission: view,
      },
      {
        path: "/payments",
        label: "Payments",
        description: "Taking deposits through Stripe, and what's refunded when customers cancel.",
        permission: view,
      },
      {
        path: "/notifications",
        label: "Notifications",
        description: "The emails customers get from you, and the alerts you get.",
        permission: view,
      },
    ],
  },
  {
    title: "Tools",
    items: [
      {
        path: "/integrations",
        label: "Integrations",
        description: "Connect Google Calendar, Google reviews, Facebook lead forms and your own systems.",
        permission: "settings.edit",
      },
      {
        path: "/assistant",
        label: "AI assistant",
        description: "Replies to enquiries for you, using your prices, hours and rules. Coming soon.",
        permission: view,
        soon: true,
      },
    ],
  },
  {
    title: "You",
    items: [
      {
        path: "/account",
        label: "Your account",
        description: "Your own login: your name, email, password and two-factor login.",
      },
    ],
  },
];

const ITEMS = GROUPS.flatMap((g) => g.items);

// The setting the address is on, compared as dashboard paths
// (/ascnd/settings), whatever form the address bar is in.
function useCurrent(slug: string) {
  const here = appPathOf(usePathname());
  const base = `/${slug}/settings`;
  const isHere = (item: Item) =>
    item.path === "" ? here === base : here === base + item.path || here.startsWith(`${base}${item.path}/`);
  return { here, base, isHere, current: ITEMS.find(isHere) };
}

// The tab's own heading: its name, and what's on it.
export function SettingsHeading({ slug }: { slug: string }) {
  const { current } = useCurrent(slug);
  return (
    <header className="grid gap-1">
      <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Settings</p>
      <h1 className="text-2xl font-semibold tracking-tight">{current?.label ?? "Settings"}</h1>
      {current && <p className="max-w-2xl text-sm text-muted-foreground">{current.description}</p>}
    </header>
  );
}

// Settings in groups: down the side on a wide screen, and on anything
// narrower a button naming the current page that opens the same list. Each
// access level only sees what it can open.
export function SettingsNav({ slug, role }: { slug: string; role: Role }) {
  const { here, base, isHere, current } = useCurrent(slug);

  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => !i.permission || can(role, i.permission)) })).filter(
    (g) => g.items.length > 0,
  );

  const list = groups.map((group) => (
    <div key={group.title} className="grid gap-0.5">
      <p className="px-3 pb-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{group.title}</p>
      {group.items.map((item) => {
        const active = isHere(item);
        return (
          <Link
            key={item.path}
            href={appUrl(base + item.path)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center justify-between gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 lg:min-h-9",
              active && "bg-muted text-foreground",
            )}
          >
            {item.label}
            {item.soon && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] font-normal">Soon</span>}
          </Link>
        );
      })}
    </div>
  ));

  return (
    <nav aria-label="Settings" className="lg:sticky lg:top-6">
      {/* Keyed so it's shut again on the next page. */}
      <details key={here} className="group rounded-lg border lg:hidden">
        <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 px-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <span>
            <span className="text-muted-foreground">Settings: </span>
            {current?.label ?? "Choose a setting"}
          </span>
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="grid gap-3 border-t p-2">{list}</div>
      </details>
      <div className="hidden gap-5 lg:grid">{list}</div>
    </nav>
  );
}
