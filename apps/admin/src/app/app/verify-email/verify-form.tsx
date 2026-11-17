"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { VerifyState } from "./actions";

type Action = (state: VerifyState, formData: FormData) => Promise<VerifyState>;

// One button and what came of it, for each action on the verify-email pages.
export function VerifyButton({
  action,
  label,
  pendingLabel,
  variant,
}: {
  action: Action;
  label: string;
  pendingLabel: string;
  variant?: "outline";
}) {
  const [state, formAction, pending] = useActionState<VerifyState, FormData>(action, {});
  return (
    <form action={formAction} className="grid gap-2">
      <Button type="submit" size="lg" variant={variant} disabled={pending} className="w-full">
        {pending ? pendingLabel : label}
      </Button>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.sent && (
        <p role="status" className="text-sm text-muted-foreground">
          Sent. It can take a minute or two to arrive.
        </p>
      )}
    </form>
  );
}
