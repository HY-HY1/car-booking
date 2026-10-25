"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DeleteCustomerButton({
  name,
  action,
}: {
  name: string;
  action: () => Promise<{ error?: string }>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  return (
    <div className="grid gap-2">
      <Button
        type="button"
        variant="destructive"
        disabled={pending}
        className="justify-self-start"
        onClick={() => {
          if (!confirm(`Erase ${name}'s personal details? This can't be undone.`)) return;
          startTransition(async () => {
            const result = await action();
            setError(result?.error);
          });
        }}
      >
        <Trash2 />
        {pending ? "Erasing…" : "Erase customer"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
