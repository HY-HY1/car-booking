"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

export function RemoveTimeOff({ action }: { action: () => Promise<{ error?: string }> }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const { error } = await action();
          if (error) toast.error(error);
          else toast.success("Time off removed");
        })
      }
    >
      {pending ? "Removing…" : "Remove"}
    </Button>
  );
}
