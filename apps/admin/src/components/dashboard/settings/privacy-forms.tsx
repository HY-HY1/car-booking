"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { REQUEST_KINDS, REQUEST_STATUSES } from "@leadgen/core/privacy/rules";
import { DEFAULT_MARKETING_CONSENT } from "@leadgen/core/settings/forms";
import type { SaveState } from "@/app/app/[tenant]/pricing/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { askToConfirm } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { Field, SaveForm, type Action } from "../form-kit";

// Settings → Privacy & data: who's responsible for customers' data, what the
// booking page says about it, requests from customers, and closing the account.

export function PrivacyDetailsForm({
  values,
  businessName,
  action,
  readOnly,
}: {
  values: { legal_name: string | null; privacy_email: string | null; ico_registration: string | null; retention_months: number };
  businessName: string;
  action: Action;
  readOnly: boolean;
}) {
  return (
    <SaveForm action={action} readOnly={readOnly}>
      {(errors) => (
        <>
          <div className="grid gap-4 @lg:grid-cols-2">
            <Field label="Legal or trading name" name="legalName" error={errors.legalName} hint="If you trade as a company, its registered name.">
              <Input name="legalName" defaultValue={values.legal_name ?? ""} placeholder={businessName} maxLength={150} />
            </Field>
            <Field label="Privacy contact email" name="privacyEmail" error={errors.privacyEmail} hint="Where customers send questions about their data.">
              <Input name="privacyEmail" type="email" inputMode="email" defaultValue={values.privacy_email ?? ""} placeholder="e.g. privacy@yourbusiness.co.uk" />
            </Field>
            <Field label="ICO registration number" name="icoRegistration" error={errors.icoRegistration} hint="From paying the ICO's data protection fee.">
              <Input
                name="icoRegistration"
                defaultValue={values.ico_registration ?? ""}
                placeholder="e.g. ZA123456"
                autoCapitalize="characters"
                autoComplete="off"
              />
            </Field>
            <Field label="Keep customer details for" name="retentionMonths" error={errors.retentionMonths} hint="12 to 84 months.">
              <NumberInput name="retentionMonths" unit="months" min={12} max={84} defaultValue={values.retention_months} />
            </Field>
          </div>
          <p className="text-muted-foreground">
            After this long with no enquiry or booking, a customer&apos;s name, contact details, address, vehicles and photos are
            erased automatically. Their past jobs stay in your records, without their details, for your accounts.
          </p>
        </>
      )}
    </SaveForm>
  );
}

export function PrivacyExtrasForm({
  values,
  action,
  readOnly,
}: {
  values: { privacy_policy_url: string | null; marketing_consent_text: string | null; photo_retention_days: number | null };
  action: Action;
  readOnly: boolean;
}) {
  const [deletePhotos, setDeletePhotos] = useState(values.photo_retention_days !== null);
  return (
    <SaveForm action={action} readOnly={readOnly}>
      {(errors) => (
        <>
          <Field
            label="Your own privacy policy"
            name="privacy_policy_url"
            error={errors.privacy_policy_url}
            hint="Optional. The booking page links here instead of the notice we write for you, so make sure it covers online bookings."
          >
            <Input
              name="privacy_policy_url"
              type="url"
              inputMode="url"
              defaultValue={values.privacy_policy_url ?? ""}
              placeholder="e.g. yourbusiness.co.uk/privacy"
            />
          </Field>
          <Field
            label="Marketing tick box wording"
            name="marketing_consent_text"
            error={errors.marketing_consent_text}
            hint="Under UK GDPR and PECR the box starts unticked, and the wording must say what you'll send and that they can unsubscribe. Blank uses the wording shown."
          >
            <Textarea
              name="marketing_consent_text"
              rows={3}
              maxLength={500}
              defaultValue={values.marketing_consent_text ?? ""}
              placeholder={DEFAULT_MARKETING_CONSENT}
            />
          </Field>
          <div className="grid gap-4 rounded-lg border p-4">
            <Switch
              checked={deletePhotos}
              onChange={(e) => setDeletePhotos(e.target.checked)}
              description={
                deletePhotos
                  ? "Older photos are deleted every night."
                  : "Off: photos are kept as long as the customer's details."
              }
            >
              Delete customer photos sooner
            </Switch>
            {deletePhotos ? (
              <Field label="Delete photos after" name="photo_retention_days" error={errors.photo_retention_days} className="max-w-48">
                <NumberInput name="photo_retention_days" unit="days" min={7} max={3650} defaultValue={values.photo_retention_days ?? 90} />
              </Field>
            ) : (
              <input type="hidden" name="photo_retention_days" value="" />
            )}
          </div>
        </>
      )}
    </SaveForm>
  );
}

export function LogRequestForm({ action }: { action: Action }) {
  return (
    <SaveForm action={action} resetOnSave submitLabel="Log request" savedText="Logged. The one-month clock has started.">
      {(errors) => (
        <div className="grid gap-4 @lg:grid-cols-2">
          <Field label="What they asked for" name="kind" error={errors.kind}>
            <Select name="kind" defaultValue="">
              <option value="" disabled>
                Choose…
              </option>
              {Object.entries(REQUEST_KINDS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Their name" name="name" error={errors.name}>
            <Input name="name" maxLength={100} autoComplete="off" />
          </Field>
          <Field label="Their email" name="email" error={errors.email} hint="Matches them to a customer.">
            <Input name="email" type="email" inputMode="email" autoComplete="off" />
          </Field>
          <Field label="Details" name="details" error={errors.details} hint="Optional.">
            <Textarea name="details" rows={2} maxLength={2000} />
          </Field>
        </div>
      )}
    </SaveForm>
  );
}

export type RequestRow = {
  id: string;
  customerHref: string | null;
  kindLabel: string;
  requesterName: string;
  requesterEmail: string | null;
  details: string | null;
  fromWebsite: boolean;
  status: string;
  identityChecked: boolean;
  receivedLabel: string;
  // "Due 3 Dec (12 days left)", "Overdue by 2 days" or "Completed 1 Dec".
  dueLabel: string;
  overdue: boolean;
  open: boolean;
  outcomeNotes: string | null;
};

export function RequestCard({ r, action }: { r: RequestRow; action: Action }) {
  return (
    <div className="grid gap-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{r.kindLabel}</p>
          <p className="text-muted-foreground">
            {r.requesterName}
            {r.requesterEmail && ` · ${r.requesterEmail}`}
          </p>
        </div>
        <Badge tone={r.open ? (r.overdue ? "danger" : "warning") : "neutral"}>{r.dueLabel}</Badge>
      </div>
      <p className="text-muted-foreground">
        Received {r.receivedLabel} ({r.fromWebsite ? "privacy page" : "logged by you"}) ·{" "}
        {r.customerHref ? (
          <Link href={r.customerHref} className="underline underline-offset-4 hover:text-foreground">
            Open the matching customer
          </Link>
        ) : (
          "No customer matched that email"
        )}
      </p>
      {r.details && <p className="rounded-lg bg-muted/50 px-3 py-2 whitespace-pre-line">{r.details}</p>}
      <SaveForm action={action} savedText="Saved.">
        {() => (
          <div className="grid gap-4 @lg:grid-cols-2">
            <Field label="Status" name="status">
              <Select name="status" defaultValue={r.status}>
                {Object.entries(REQUEST_STATUSES).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-end">
              <Switch name="identity_checked" defaultChecked={r.identityChecked} labelClassName="w-full rounded-lg border px-3 py-2.5">
                I&apos;ve checked who they are
              </Switch>
            </div>
            <Field label="What you did" name="outcome_notes" className="@lg:col-span-2">
              <Textarea name="outcome_notes" rows={2} maxLength={2000} defaultValue={r.outcomeNotes ?? ""} />
            </Field>
          </div>
        )}
      </SaveForm>
    </div>
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

  if (requestedAt) {
    return (
      <div className="grid gap-4">
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive">
          This account is set to be deleted on <strong>{deleteOn}</strong>.
        </p>
        <p>Billing stops at the end of the current period. Until then everything works as normal, and you can change your mind.</p>
        <Button
          type="button"
          size="lg"
          className="justify-self-start"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const { message } = await cancelAction();
              if (message) toast.error(message);
              else toast.success("Your account is staying open");
            })
          }
        >
          {pending ? "Saving…" : "Keep my account"}
        </Button>
      </div>
    );
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="destructive"
        size="lg"
        className="justify-self-start"
        onClick={async () => {
          const confirmed = await askToConfirm({
            title: `Delete ${businessName}?`,
            description:
              "Your booking page stops taking bookings and everything is deleted 30 days from now. You can change your mind until then. Download your data first: after deletion it can't be recovered.",
            confirmLabel: "Continue",
            destructive: true,
          });
          if (confirmed) setOpen(true);
        }}
      >
        Delete account…
      </Button>
    );
  }

  return (
    <div className="grid gap-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
      <p>
        Type the business name to confirm. Everything is deleted 30 days from now; billing stops at the end of the current
        period.
      </p>
      <SaveForm
        action={requestAction}
        danger
        submitLabel="Delete my account"
        savedText="Done. Your account will be deleted in 30 days."
        extra={
          <Button type="button" variant="ghost" size="lg" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        }
      >
        {(errors) => (
          <Field label={`Type ${businessName}`} name="confirm_name" error={errors.confirm_name} className="max-w-sm">
            <Input name="confirm_name" autoComplete="off" spellCheck={false} />
          </Field>
        )}
      </SaveForm>
    </div>
  );
}
