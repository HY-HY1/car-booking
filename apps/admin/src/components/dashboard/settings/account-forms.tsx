"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { askToConfirm } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Field, SaveForm, type Action } from "../form-kit";

// Settings → Your account: the signed-in person.

export function ProfileForm({ values, action }: { values: { full_name: string; phone: string }; action: Action }) {
  return (
    <SaveForm action={action} savedText="Saved.">
      {(errors) => (
        <div className="grid gap-4 @lg:grid-cols-2">
          <Field label="Your name" name="full_name" error={errors.full_name}>
            <Input name="full_name" defaultValue={values.full_name} autoComplete="name" maxLength={100} />
          </Field>
          <Field label="Your mobile" name="phone" error={errors.phone}>
            <Input name="phone" type="tel" inputMode="tel" defaultValue={values.phone} autoComplete="tel" />
          </Field>
        </div>
      )}
    </SaveForm>
  );
}

export function EmailForm({ action }: { action: Action }) {
  return (
    <SaveForm
      action={action}
      submitLabel="Change email"
      savedText="Check your inbox: click the link we've sent to confirm the change."
      resetOnSave
    >
      {(errors) => (
        <Field
          label="New email address"
          name="email"
          error={errors.email}
          hint="We email a link to confirm it. Nothing changes until it's clicked."
          className="max-w-md"
        >
          <Input name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} />
        </Field>
      )}
    </SaveForm>
  );
}

export function PasswordForm({ action, twoFactorOn }: { action: Action; twoFactorOn: boolean }) {
  return (
    <SaveForm action={action} submitLabel="Change password" savedText="Password changed." resetOnSave>
      {(errors) => (
        <>
          <div className="grid gap-4 @lg:grid-cols-2">
            <Field label="Current password" name="current" error={errors.current}>
              <Input name="current" type="password" autoComplete="current-password" />
            </Field>
            {twoFactorOn && (
              <Field label="Code from your authenticator app" name="code" error={errors.code}>
                <Input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="123456" />
              </Field>
            )}
          </div>
          <div className="grid gap-4 border-t pt-5 @lg:grid-cols-2">
            <Field label="New password" name="password" error={errors.password} hint="At least 10 characters.">
              <Input name="password" type="password" autoComplete="new-password" minLength={10} />
            </Field>
            <Field label="Type it again" name="confirm" error={errors.confirm}>
              <Input name="confirm" type="password" autoComplete="new-password" />
            </Field>
          </div>
        </>
      )}
    </SaveForm>
  );
}

export function SignOutEverywhere({ action }: { action: () => Promise<void> }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="destructive"
      size="lg"
      className="justify-self-start"
      disabled={pending}
      onClick={async () => {
        const confirmed = await askToConfirm({
          title: "Sign out everywhere?",
          description: "Every device signed in to your account is signed out, this one included. You'll need your password to sign back in.",
          confirmLabel: "Sign out everywhere",
          destructive: true,
        });
        if (confirmed) startTransition(() => action());
      }}
    >
      <LogOut /> {pending ? "Signing out…" : "Sign out everywhere"}
    </Button>
  );
}
