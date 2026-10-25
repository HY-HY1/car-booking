"use client";

import { Input } from "@/components/ui/input";
import { Field, SaveForm, type Action } from "../form-kit";

// Settings → Account: the signed-in person.

export function ProfileForm({ values, action }: { values: { full_name: string; phone: string }; action: Action }) {
  return (
    <SaveForm action={action} savedText="Saved.">
      {(errors) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name" name="full_name" error={errors.full_name}>
            <Input name="full_name" defaultValue={values.full_name} autoComplete="name" />
          </Field>
          <Field label="Your mobile" name="phone" error={errors.phone}>
            <Input name="phone" type="tel" defaultValue={values.phone} autoComplete="tel" />
          </Field>
        </div>
      )}
    </SaveForm>
  );
}

export function EmailForm({ current, action }: { current: string | null; action: Action }) {
  return (
    <SaveForm
      action={action}
      submitLabel="Change email"
      savedText="Check your inbox: click the link we've sent to confirm the change."
      resetOnSave
    >
      {(errors) => (
        <Field label="New email address" name="email" error={errors.email} className="max-w-md">
          <Input name="email" type="email" placeholder={current ?? ""} autoComplete="email" />
        </Field>
      )}
    </SaveForm>
  );
}

export function PasswordForm({ action }: { action: Action }) {
  return (
    <SaveForm action={action} submitLabel="Change password" savedText="Password changed." resetOnSave>
      {(errors) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New password" name="password" error={errors.password}>
            <Input name="password" type="password" autoComplete="new-password" minLength={10} />
          </Field>
          <Field label="Type it again" name="confirm" error={errors.confirm}>
            <Input name="confirm" type="password" autoComplete="new-password" />
          </Field>
        </div>
      )}
    </SaveForm>
  );
}
