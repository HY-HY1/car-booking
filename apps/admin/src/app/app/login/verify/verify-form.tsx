"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { verifySecondFactor, type VerifyState } from "./actions";

export function VerifyForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<VerifyState, FormData>(verifySecondFactor, {});

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="next" value={next} />
      <Field label="6-digit code" name="code" error={state.error}>
        <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required autoFocus />
      </Field>
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Checking…" : "Continue"}
      </Button>
    </form>
  );
}
