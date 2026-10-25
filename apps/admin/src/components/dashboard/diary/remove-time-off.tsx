"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export function RemoveTimeOff({ action }: { action: () => Promise<{ error?: string }> }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  return (
    <span className="flex items-center gap-2">
      {error && <span className="text-xs text-destructive">{error}</span>}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await action();
            setError(result.error);
          })
        }
      >
        {pending ? "Removing…" : "Remove"}
      </Button>
    </span>
  );
}
