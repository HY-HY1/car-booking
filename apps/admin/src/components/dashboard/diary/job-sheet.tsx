"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { Drawer } from "@base-ui/react/drawer";

const DESKTOP = "(min-width: 48rem)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(DESKTOP);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

// The job's panel: a sheet up from the bottom on a phone, a panel down the
// right on anything wider. Beside the grid it doesn't block the page, so you
// can click from job to job. The open job is in the address, so closing goes
// to the address without it.
export function JobSheet({
  jobId,
  title,
  subtitle,
  status,
  closeHref,
  footer,
  children,
}: {
  jobId: string;
  title: string;
  subtitle: string;
  status: React.ReactNode;
  closeHref: string;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const desktop = useSyncExternalStore(subscribe, () => window.matchMedia(DESKTOP).matches, () => false);

  return (
    <Drawer.Root
      open={open}
      onOpenChange={setOpen}
      onOpenChangeComplete={(next) => {
        if (!next) router.push(closeHref, { scroll: false });
      }}
      modal={!desktop}
      disablePointerDismissal={desktop}
      swipeDirection={desktop ? "right" : "down"}
    >
      <Drawer.Portal>
        <Drawer.Backdrop className="fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 md:hidden" />
        <Drawer.Viewport className="pointer-events-none fixed inset-0 z-40 flex items-end md:items-stretch md:justify-end">
          <Drawer.Popup
            // Portalled outside the dashboard, so it asks for the brand colours itself.
            data-brand=""
            className="pointer-events-auto flex max-h-[88dvh] w-full transform-[translate(var(--drawer-swipe-movement-x),var(--drawer-swipe-movement-y))] flex-col rounded-t-2xl border-t bg-popover text-popover-foreground shadow-xl transition-[transform,translate] duration-250 ease-out outline-none data-ending-style:translate-y-full data-starting-style:translate-y-full data-swiping:select-none data-swiping:duration-0 md:h-dvh md:max-h-none md:w-md md:rounded-none md:border-t-0 md:border-l md:data-ending-style:translate-x-full md:data-ending-style:translate-y-0 md:data-starting-style:translate-x-full md:data-starting-style:translate-y-0"
          >
            <div aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30 md:hidden" />
            <header className="flex items-start justify-between gap-3 border-b p-4">
              <div className="min-w-0">
                <Drawer.Title className="text-lg font-semibold tracking-tight">{title}</Drawer.Title>
                <Drawer.Description className="text-sm text-muted-foreground">{subtitle}</Drawer.Description>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {status}
                <Drawer.Close
                  aria-label="Close"
                  className="-m-1.5 grid size-11 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground md:m-0 md:size-8"
                >
                  <X className="size-4" />
                </Drawer.Close>
              </div>
            </header>
            {/* Keyed so each job opens at the top. Text in here can be selected without swiping the panel away. */}
            <Drawer.Content key={jobId} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
              {children}
            </Drawer.Content>
            <footer className="flex flex-wrap items-center gap-2 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {footer}
            </footer>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
