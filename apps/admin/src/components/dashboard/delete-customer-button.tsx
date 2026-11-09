"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { askToConfirm } from "@/components/ui/confirm-dialog";

export function DeleteCustomerButton({
  name,
  action,
}: {
  name: string;
  action: () => Promise<{ error?: string }>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="destructive"
      disabled={pending}
      className="justify-self-start"
      onClick={async () => {
        const confirmed = await askToConfirm({
          title: `Erase ${name}'s personal details?`,
          description: "This can't be undone.",
          confirmLabel: "Erase customer",
          destructive: true,
        });
        if (!confirmed) return;
        startTransition(async () => {
          // On success the action moves on to the customer's page, which says so.
          const result = await action();
          if (result?.error) toast.error(result.error);
        });
      }}
    >
      <Trash2 />
      {pending ? "Erasing…" : "Erase customer"}
    </Button>
  );
}
