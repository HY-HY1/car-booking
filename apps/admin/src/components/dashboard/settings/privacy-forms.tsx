"use client";

import { useState, useTransition } from "react";
import { DEFAULT_MARKETING_CONSENT } from "@leadgen/core/settings/forms";
import type { SaveState } from "@/app/app/[tenant]/pricing/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, SaveForm, fieldClass, type Action } from "../form-kit";

// Settings → Privacy & data: the extras beside the controller details, and
// closing the account.

export function PrivacyExtrasForm({
  values,
  action,
  readOnly,
}: {
  values: { privacy_policy_url: string | null; marketing_consent_text: string | null; photo_retention_days: number | null };
  action: Action;
  readOnly: boolean;
}) {
  return (
    <SaveForm action={action} readOnly={readOnly}>
      {(errors) => (
        <>
          <Field label="Your own privacy policy (optional)" name="privacy_policy_url" error={errors.privacy_policy_url}>
            <Input name="privacy_policy_url" defaultValue={values.privacy_policy_url ?? ""} placeholder="https://yourbusiness.co.uk/privacy" />
          </Field>
          <p className="-mt-3 text-xs text-muted-foreground">
            The booking page links here instead of the privacy notice we write for you. Make sure it covers online bookings.
          </p>
          <Field label="Marketing tick box wording" name="marketing_consent_text" error={errors.marketing_consent_text}>
            <textarea
              name="marketing_consent_text"
              rows={2}
              maxLength={500}
              defaultValue={values.marketing_consent_text ?? ""}
              placeholder={DEFAULT_MARKETING_CONSENT}
              className={fieldClass}
            />
          </Field>
          <p className="-mt-3 text-xs text-muted-foreground">
            Under UK GDPR and PECR the box starts unticked, and the wording must say what you&apos;ll send and that they can
            unsubscribe. Leave it blank to use ours.
          </p>
          <Field label="Delete customer photos after (days)" name="photo_retention_days" error={errors.photo_retention_days} className="max-w-xs">
            <Input
              name="photo_retention_days"
              inputMode="numeric"
              defaultValue={values.photo_retention_days ?? ""}
              placeholder="Keep with the customer"
            />
          </Field>
          <p className="-mt-3 text-xs text-muted-foreground">
            Blank keeps photos as long as the customer&apos;s details. Photos older than this are deleted every night.
          </p>
        </>
      )}
    </SaveForm>
  );
}

export function CloseAccount({
  businessName,
  requestedAt,
  deleteOn,
  requestAction,
  cancelAction,
}: {
  businessName: string;
  requestedAt: string | null;
  deleteOn: string | null;
  requestAction: Action;
  cancelAction: () => Promise<SaveState>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();

  if (requestedAt) {
    return (
      <div className="grid gap-3">
        <p className="text-sm">
          This account is set to be deleted on <strong>{deleteOn}</strong>. Billing stops at the end of the current period.
          Until then everything works as normal, and you can change your mind.
        </p>
        <Button
          type="button"
          variant="outline"
          className="justify-self-start"
          disabled={pending}
          onClick={() => startTransition(async () => setMessage((await cancelAction()).message))}
        >
          {pending ? "Saving…" : "Keep my account"}
        </Button>
        {message && <p className="text-sm text-destructive">{message}</p>}
      </div>
    );
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" className="justify-self-start text-destructive" onClick={() => setOpen(true)}>
        Delete account…
      </Button>
    );
  }

  return (
    <div className="grid gap-3 rounded-xl border border-destructive/40 p-4">
      <p className="text-sm">
        Your booking page stops taking bookings when the account is deleted, 30 days from now. Billing stops at the end of
        the current period. Download your data first: after deletion it can&apos;t be recovered.
      </p>
      <SaveForm action={requestAction} submitLabel="Delete my account" savedText="Done.">
        {(errors) => (
          <Field label={`Type ${businessName} to confirm`} name="confirm_name" error={errors.confirm_name} className="max-w-sm">
            <Input name="confirm_name" autoComplete="off" />
          </Field>
        )}
      </SaveForm>
      <Button type="button" variant="ghost" className="justify-self-start" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  );
}
