"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { askToConfirm } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";

type Result = { ok?: true; error?: string; message?: string } | void;

// A button that runs one server action, asking first if `confirm` is given,
// and says how it went.
export function ActionButton({
  action,
  children,
  pendingLabel,
  success,
  confirm,
  variant = "outline",
  size = "sm",
}: {
  action: () => Promise<Result>;
  children: React.ReactNode;
  pendingLabel?: string;
  success?: string;
  confirm?: { title: string; description?: string; confirmLabel?: string; destructive?: boolean };
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "sm" | "default";
}) {
  const [pending, startTransition] = useTransition();

  async function run() {
    if (confirm && !(await askToConfirm(confirm))) return;
    startTransition(async () => {
      const result = await action();
      if (result?.error) toast.error(result.error);
      else if (result?.message || success) toast.success(result?.message ?? success!);
    });
  }

  return (
    <Button type="button" variant={variant} size={size} disabled={pending} onClick={run}>
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
