"use client";

import { useTransition } from "react";
import type { SaveState } from "@/app/app/[tenant]/pricing/actions";
import { Button } from "@/components/ui/button";
import { askToConfirm } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

// Shared by the Integrations cards.

export type Outcome = { text: string; good?: boolean };

export function OutcomeNote({ note }: { note: Outcome | undefined }) {
  if (!note) return null;
  return (
    <p role="status" className={cn("text-sm", note.good ? "text-emerald-700 dark:text-emerald-400" : "text-destructive")}>
      {note.text}
    </p>
  );
}

export function DisconnectButton({
  title,
  description,
  done,
  action,
}: {
  title: string;
  description: string;
  done: string;
  action: () => Promise<SaveState>;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      disabled={pending}
      className="text-destructive"
      onClick={async () => {
        const confirmed = await askToConfirm({ title, description, confirmLabel: "Disconnect", destructive: true });
        if (!confirmed) return;
        startTransition(async () => {
          const { message } = await action();
          if (message) toast.error(message);
          else toast.success(done);
        });
      }}
    >
      {pending ? "Disconnecting…" : "Disconnect"}
    </Button>
  );
}

export function ActionButton({
  label,
  busyLabel,
  done,
  action,
  variant = "outline",
}: {
  label: string;
  busyLabel: string;
  done: string;
  action: () => Promise<SaveState>;
  variant?: "outline" | "ghost" | "default";
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant={variant}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const { message } = await action();
          if (message) toast.error(message);
          else toast.success(done);
        })
      }
    >
      {pending ? busyLabel : label}
    </Button>
  );
}
