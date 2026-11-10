"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { requestPasswordReset, type ForgotState } from "./actions";

export function ForgotForm() {
  const [state, formAction, pending] = useActionState<ForgotState, FormData>(requestPasswordReset, {});

  if (state.sent) {
    return (
      <p role="status" className="text-sm">
        If that email has an account, a link to reset the password is on its way. It lasts for an hour. Check your junk folder if it doesn&apos;t arrive.
      </p>
    );
  }

  return (
    <form action={formAction} className="grid gap-4">
      <Field label="Email" name="email" error={state.error}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
