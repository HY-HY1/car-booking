"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { changePassword, type PasswordState } from "./actions";
import { toast } from "@/components/ui/toast";

export function PasswordForm() {
  const [state, formAction, pending] = useActionState<PasswordState, FormData>(async (prev, formData) => {
    const next = await changePassword(prev, formData);
    if (next.saved) toast.success("Password changed");
    return next;
  }, {});

  return (
    <form action={formAction} className="grid gap-4">
      <Field label="New password" name="password">
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
      </Field>
      <Field label="Confirm new password" name="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={10} />
      </Field>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Change password"}
      </Button>
    </form>
  );
}
