"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { ResetState } from "./actions";

export function ResetForm({ action }: { action: (state: ResetState, formData: FormData) => Promise<ResetState> }) {
  const [state, formAction, pending] = useActionState<ResetState, FormData>(action, {});

  return (
    <form action={formAction} className="grid gap-4">
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Checking…" : "Continue"}
      </Button>
    </form>
  );
}
