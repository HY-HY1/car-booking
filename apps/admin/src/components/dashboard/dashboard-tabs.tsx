"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Drawer } from "@base-ui/react/drawer";
import type { Role } from "@leadgen/core/team/access";
import { cn } from "@/lib/utils";
import { appPathOf, appUrl } from "@/lib/urls";
import { isActive, navSections, type NavItem } from "./dashboard-nav";

// The most used pages get a tab each; everything else is under More.
const TABS = ["", "/diary", "/bookings", "/leads"];

const tabClass = "flex h-15 min-w-0 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-sidebar-foreground/70";

function TabIcon({ icon: Icon, active }: { icon: NavItem["icon"]; active: boolean }) {
  return (
    <span className={cn("grid h-7 w-14 place-items-center rounded-full transition-colors", active && "bg-nav-active text-nav-active-foreground")}>
      <Icon className="size-5" />
    </span>
  );
}

// The menu on a phone: tabs fixed along the bottom, with a More sheet. The
// sticky save bars sit above them using --bottom-nav (the dashboard layout).
export function DashboardTabs({
  slug,
  role,
  setupDone,
  children,
}: {
  slug: string;
  role: Role;
  setupDone: boolean;
  // The account links at the foot of the sheet.
  children: React.ReactNode;
}) {
  const here = appPathOf(usePathname());
  const base = `/${slug}`;
  // Remembers the page it was opened on, so moving to another page closes it,
  // including after the unsaved-changes warning, which a link's onClick misses.
  const [openedOn, setOpenedOn] = useState<string | null>(null);

  const sections = navSections(role, setupDone);
  const tabs = sections.flatMap((s) => s.items).filter((i) => TABS.includes(i.href));
  const more = sections
    .map((s) => ({ ...s, items: s.items.filter((i) => !TABS.includes(i.href)) }))
    .filter((s) => s.items.length > 0);
  const moreActive = more.some((s) => s.items.some((i) => isActive(here, base, i.href)));

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 grid auto-cols-fr grid-flow-col border-t bg-sidebar pb-[env(safe-area-inset-bottom)] text-sidebar-foreground md:hidden"
    >
      {tabs.map(({ href, label, icon }) => {
        const active = isActive(here, base, href);
        return (
          <Link key={label} href={appUrl(base + href)} aria-current={active ? "page" : undefined} className={cn(tabClass, active && "text-sidebar-foreground")}>
            <TabIcon icon={icon} active={active} />
            {label}
          </Link>
        );
      })}

      <Drawer.Root open={openedOn === here} onOpenChange={(next) => setOpenedOn(next ? here : null)} swipeDirection="down">
        <Drawer.Trigger aria-current={moreActive ? "page" : undefined} className={cn(tabClass, moreActive && "text-sidebar-foreground")}>
          <TabIcon icon={Menu} active={moreActive} />
          More
        </Drawer.Trigger>
        <Drawer.Portal>
          <Drawer.Backdrop className="fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <Drawer.Viewport className="pointer-events-none fixed inset-0 z-40 flex items-end">
            <Drawer.Popup
              // Portalled outside the dashboard, so it asks for the brand colours itself.
              data-brand=""
              className="pointer-events-auto flex max-h-[88dvh] w-full transform-[translate(var(--drawer-swipe-movement-x),var(--drawer-swipe-movement-y))] flex-col rounded-t-2xl border-t bg-popover text-popover-foreground shadow-xl transition-[transform,translate] duration-250 ease-out outline-none data-ending-style:translate-y-full data-starting-style:translate-y-full data-swiping:select-none data-swiping:duration-0"
            >
              <div aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
              <header className="flex items-center justify-between gap-3 px-4 pt-2">
                <Drawer.Title className="text-lg font-semibold tracking-tight">More</Drawer.Title>
                <Drawer.Close aria-label="Close" className="-mr-2.5 grid size-11 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
                  <X className="size-4" />
                </Drawer.Close>
              </header>
              <Drawer.Content className="grid min-h-0 flex-1 gap-4 overflow-y-auto overscroll-contain px-4 pt-1 pb-[max(1rem,env(safe-area-inset-bottom))]">
                {more.map((section) => (
                  <div key={section.items[0].href}>
                    {section.title && <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{section.title}</p>}
                    {section.items.map(({ href, label, icon: Icon }) => {
                      const active = isActive(here, base, href);
                      return (
                        <Link
                          key={label}
                          href={appUrl(base + href)}
                          onClick={() => setOpenedOn(null)}
                          aria-current={active ? "page" : undefined}
                          className={cn("flex h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium hover:bg-muted", active && "bg-nav-active text-nav-active-foreground")}
                        >
                          <Icon className="size-5" />
                          {label}
                        </Link>
                      );
                    })}
                  </div>
                ))}
                <div className="border-t pt-4">{children}</div>
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    </nav>
  );
}
