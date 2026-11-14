"use client";

import { useTransition } from "react";
import type { SaveState } from "@/app/app/[tenant]/pricing/actions";
import { Button } from "@/components/ui/button";
import { askToConfirm } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

// Shared by the Integrations cards.

// The card each connected app sits in.
export const appCard = "grid gap-4 rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10 sm:p-6";

// An app's name, what it does and its status, across the top of its card.
export function AppHeader({ name, about, badge }: { name: string; about: string; badge: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <span className="min-w-0">
        <span className="block font-semibold">{name}</span>
        <span className="block text-muted-foreground">{about}</span>
      </span>
      {badge}
    </div>
  );
}

export type Outcome = { text: string; good?: boolean };

export function OutcomeNote({ note }: { note: Outcome | undefined }) {
  if (!note) return null;
  return (
    <p
      role="status"
      className={cn(
        "rounded-lg px-3 py-2 text-sm",
        note.good
          ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
          : "bg-destructive/10 text-destructive",
      )}
    >
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
      variant="destructive"
      disabled={pending}
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
