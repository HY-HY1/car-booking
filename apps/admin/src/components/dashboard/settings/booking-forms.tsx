"use client";

import { useState } from "react";
import { DEFAULT_POLICY, policyLines, type CancellationPolicy } from "@leadgen/core/settings/policy";
import { OPTIONAL_QUESTIONS, QUESTION_KEYS, type Questions } from "@leadgen/core/settings/questions";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Check, Field, SaveForm, fieldClass, type Action } from "../form-kit";

// Settings → Booking: what customers are asked, approval, and the
// cancellation policy.

export function AskingForm({
  settings,
  questions,
  action,
  readOnly,
}: {
  settings: { photos_required: boolean; min_photos: number; approval_mode: "auto" | "manual" };
  questions: Questions;
  action: Action;
  readOnly: boolean;
}) {
  const [photos, setPhotos] = useState(settings.photos_required);
  return (
    <SaveForm action={action} readOnly={readOnly}>
      {(errors) => (
        <>
          <fieldset className="grid gap-3">
            <legend className="mb-2 text-sm font-medium">New bookings</legend>
            <label className="flex items-start gap-2 text-sm">
              <input type="radio" name="approval_mode" value="auto" defaultChecked={settings.approval_mode === "auto"} className="mt-0.5 size-4 accent-primary" />
              <span>
                Confirm straight away
                <span className="block text-muted-foreground">The customer is booked in as soon as they finish (and pay any deposit).</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="radio" name="approval_mode" value="manual" defaultChecked={settings.approval_mode === "manual"} className="mt-0.5 size-4 accent-primary" />
              <span>
                I approve each booking
                <span className="block text-muted-foreground">
                  The time is kept for them while you decide. Declining frees it and refunds any deposit in full.
                </span>
              </span>
            </label>
          </fieldset>

          <fieldset className="grid gap-3">
            <legend className="mb-2 text-sm font-medium">Photos of the car</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="photos_required"
                checked={photos}
                onChange={(e) => setPhotos(e.target.checked)}
                className="size-4 accent-primary"
              />
              Customers must add photos before they can book
            </label>
            {photos ? (
              <Field label="At least this many" name="min_photos" error={errors.min_photos} className="max-w-40">
                <select name="min_photos" defaultValue={settings.min_photos} className={cn(fieldClass, "h-8")}>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <input type="hidden" name="min_photos" value={settings.min_photos} />
            )}
            <p className="text-xs text-muted-foreground">
              Without photos, the car&apos;s condition can&apos;t be priced from them, so you confirm the price when you see it.
            </p>
          </fieldset>

          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">Questions on the booking page</legend>
            <p className="mb-1 text-xs text-muted-foreground">
              The make, model and size of the car are always asked, as the price depends on them.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {QUESTION_KEYS.map((k) => (
                <Check key={k} name={`q_${k}`} label={OPTIONAL_QUESTIONS[k]} defaultChecked={questions[k]} />
              ))}
            </div>
          </fieldset>
        </>
      )}
    </SaveForm>
  );
}

export function PolicyForm({ policy, action, readOnly }: { policy: CancellationPolicy | null; action: Action; readOnly: boolean }) {
  const [on, setOn] = useState(!!policy);
  const shown = policy ?? DEFAULT_POLICY;
  const [cutoff, setCutoff] = useState(String(shown.cutoff_hours));
  const [move, setMove] = useState(String(shown.reschedule_cutoff_hours));
  const [note, setNote] = useState(shown.note ?? "");
  const preview: CancellationPolicy = {
    ...shown,
    cutoff_hours: Number(cutoff) || 0,
    reschedule_cutoff_hours: Number(move) || 0,
    note: note.trim() || undefined,
  };

  return (
    <SaveForm action={action} readOnly={readOnly}>
      {(errors) => (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="policy_enabled"
              checked={on}
              onChange={(e) => setOn(e.target.checked)}
              className="size-4 accent-primary"
            />
            Show a cancellation policy to customers
          </label>
          {on ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Free cancellation up to (hours before)" name="cutoff_hours" error={errors.cutoff_hours}>
                  <Input name="cutoff_hours" inputMode="numeric" value={cutoff} onChange={(e) => setCutoff(e.target.value)} />
                </Field>
                <Field label="Change the time up to (hours before)" name="reschedule_cutoff_hours" error={errors.reschedule_cutoff_hours}>
                  <Input name="reschedule_cutoff_hours" inputMode="numeric" value={move} onChange={(e) => setMove(e.target.value)} />
                </Field>
              </div>
              <Field label="Anything else customers should know (optional)" name="note" error={errors.note}>
                <textarea
                  name="note"
                  rows={2}
                  maxLength={500}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className={fieldClass}
                  placeholder="Bad weather? We'll move you to the next free day at no cost."
                />
              </Field>
              <div className="rounded-lg bg-muted p-3 text-sm">
                <p className="mb-1 text-xs font-medium text-muted-foreground uppercase">Customers see</p>
                {policyLines(preview, true).map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                What happens to the deposit is set under Settings → Payments.
              </p>
            </>
          ) : (
            <>
              <input type="hidden" name="cutoff_hours" value={cutoff} />
              <input type="hidden" name="reschedule_cutoff_hours" value={move} />
              <p className="text-sm text-muted-foreground">
                No policy is shown, and refunds are up to you case by case.
              </p>
            </>
          )}
        </>
      )}
    </SaveForm>
  );
}
