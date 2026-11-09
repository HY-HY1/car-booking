"use client";

import { useState } from "react";
import { DEFAULT_POLICY, policyLines, type CancellationPolicy } from "@leadgen/core/settings/policy";
import { OPTIONAL_QUESTIONS, QUESTION_KEYS, type Questions } from "@leadgen/core/settings/questions";
import { Input } from "@/components/ui/input";
import { Check, Field, SaveForm, type Action } from "../form-kit";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox, Radio } from "@/components/ui/checkbox";

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
            <Radio name="approval_mode" value="auto" defaultChecked={settings.approval_mode === "auto"}>
              <span>
                Confirm straight away
                <span className="block text-muted-foreground">The customer is booked in as soon as they finish (and pay any deposit).</span>
              </span>
            </Radio>
            <Radio name="approval_mode" value="manual" defaultChecked={settings.approval_mode === "manual"}>
              <span>
                I approve each booking
                <span className="block text-muted-foreground">
                  The time is kept for them while you decide. Declining frees it and refunds any deposit in full.
                </span>
              </span>
            </Radio>
          </fieldset>

          <fieldset className="grid gap-3">
            <legend className="mb-2 text-sm font-medium">Photos of the car</legend>
            <Checkbox
              name="photos_required"
              checked={photos}
              onChange={(e) => setPhotos(e.target.checked)}
            >
              Customers must add photos before they can book
            </Checkbox>
            {photos ? (
              <Field label="At least this many" name="min_photos" error={errors.min_photos} className="max-w-40">
                <Select name="min_photos" defaultValue={settings.min_photos}>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
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
  const [selfService, setSelfService] = useState(shown.self_service);
  const [maxMoves, setMaxMoves] = useState(shown.max_reschedules ? String(shown.max_reschedules) : "");
  const preview: CancellationPolicy = {
    ...shown,
    cutoff_hours: Number(cutoff) || 0,
    reschedule_cutoff_hours: Number(move) || 0,
    note: note.trim() || undefined,
    self_service: selfService,
    max_reschedules: selfService && Number(maxMoves) > 0 ? Number(maxMoves) : undefined,
  };

  return (
    <SaveForm action={action} readOnly={readOnly}>
      {(errors) => (
        <>
          <Checkbox
            name="policy_enabled"
            checked={on}
            onChange={(e) => setOn(e.target.checked)}
          >
            Show a cancellation policy to customers
          </Checkbox>
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
              <Checkbox
                name="self_service"
                checked={selfService}
                onChange={(e) => setSelfService(e.target.checked)}
              >
                <span>
                  Let customers cancel and change the time themselves
                  <span className="block text-muted-foreground">
                    From the link in their confirmation and reminder emails, up to the cut-offs above. You&apos;re
                    emailed whenever they do, and any deposit refund is left for you to make.
                  </span>
                </span>
              </Checkbox>
              {selfService ? (
                <Field label="Times a customer can change one booking (blank for no limit)" name="max_reschedules" error={errors.max_reschedules}>
                  <Input
                    name="max_reschedules"
                    inputMode="numeric"
                    value={maxMoves}
                    onChange={(e) => setMaxMoves(e.target.value)}
                    className="sm:max-w-32"
                  />
                </Field>
              ) : (
                <input type="hidden" name="max_reschedules" value={maxMoves} />
              )}
              <Field label="Anything else customers should know (optional)" name="note" error={errors.note}>
                <Textarea
                  name="note"
                  rows={2}
                  maxLength={500}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
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
