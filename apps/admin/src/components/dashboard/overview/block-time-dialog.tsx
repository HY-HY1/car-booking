"use client";

import { useState } from "react";
import { CalendarOff, X } from "lucide-react";
import { Dialog } from "@base-ui/react/dialog";
import type { BlockTimeState } from "@/app/app/[tenant]/diary/actions";
import { BlockTimeForm } from "@/components/dashboard/diary/block-time-form";
import { Button } from "@/components/ui/button";

// The diary's "Block out time" form, opened from the overview's quick actions.
// Closes itself once saved, unless there's a clash the form needs to mention.
export function BlockTimeDialog({
  action,
  defaultDate,
  resources,
}: {
  action: (state: BlockTimeState, formData: FormData) => Promise<BlockTimeState>;
  defaultDate: string;
  resources: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger render={<Button variant="outline" size="lg" />}>
        <CalendarOff />
        Block time
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup
          // Portalled outside the dashboard, so it asks for the brand colours itself.
          data-brand=""
          className="fixed top-1/2 left-1/2 z-50 grid max-h-[88dvh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-xl border bg-popover p-5 text-popover-foreground shadow-lg transition-all duration-150 outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="grid gap-1.5">
              <Dialog.Title className="text-base font-semibold">Block out time</Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground">
                Customers can&apos;t book into it. Jobs already in that time stay on your diary.
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Close"
              className="-m-1.5 grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground md:m-0 md:size-8"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <BlockTimeForm action={action} defaultDate={defaultDate} resources={resources} onSaved={() => setOpen(false)} />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
