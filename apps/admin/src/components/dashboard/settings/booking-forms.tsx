"use client";

import { useState } from "react";
import { DEFAULT_POLICY, policyLines, type CancellationPolicy } from "@leadgen/core/settings/policy";
import { OPTIONAL_QUESTIONS, QUESTION_KEYS, type Questions } from "@leadgen/core/settings/questions";
import { NumberInput } from "@/components/ui/number-input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox, Radio } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Field, SaveForm, type Action } from "../form-kit";

// Settings → Hours & rules: what customers are asked, approval, and the
// cancellation policy.

const choiceCard = "rounded-lg border p-3 has-checked:border-primary has-checked:bg-primary/5";

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
            <legend className="mb-3 text-sm font-semibold">New bookings</legend>
            <div className="grid gap-2 @lg:grid-cols-2">
              <Radio name="approval_mode" value="auto" defaultChecked={settings.approval_mode === "auto"} labelClassName={choiceCard}>
                <span className="font-medium">Confirm straight away</span>
                <span className="block text-muted-foreground">
                  The customer is booked in as soon as they finish (and pay any deposit).
                </span>
              </Radio>
              <Radio name="approval_mode" value="manual" defaultChecked={settings.approval_mode === "manual"} labelClassName={choiceCard}>
                <span className="font-medium">I approve each booking</span>
                <span className="block text-muted-foreground">
                  The time is kept while you decide. Declining frees it and refunds any deposit in full.
                </span>
              </Radio>
            </div>
            {errors.approval_mode && (
              <p role="alert" className="text-sm text-destructive">
                {errors.approval_mode}
              </p>
            )}
          </fieldset>

          <div className="grid gap-4 border-t pt-5">
            <Switch
              name="photos_required"
              checked={photos}
              onChange={(e) => setPhotos(e.target.checked)}
              description="Without photos the car's condition can't be priced from them, so you confirm the price when you see it."
            >
              Customers must add photos of the car
            </Switch>
            {/* Still sent while hidden, so the number is kept for next time. */}
            <Field label="At least" name="min_photos" error={errors.min_photos} className={cn("max-w-40", !photos && "hidden")}>
              <Select name="min_photos" defaultValue={settings.min_photos}>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "photo" : "photos"}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <fieldset className="grid gap-3 border-t pt-5">
            <legend className="sr-only">Questions on the booking page</legend>
            <div className="grid gap-0.5">
              <p className="text-sm font-semibold">Questions on the booking page</p>
              <p className="text-sm text-muted-foreground">
                The make, model and size of the car are always asked, as the price depends on them.
              </p>
            </div>
            <div className="grid gap-2 @lg:grid-cols-2">
              {QUESTION_KEYS.map((k) => (
                <Checkbox key={k} name={`q_${k}`} defaultChecked={questions[k]} labelClassName="rounded-lg border px-3 py-2.5">
                  {OPTIONAL_QUESTIONS[k]}
                </Checkbox>
              ))}
            </div>
          </fieldset>
        </>
      )}
    </SaveForm>
  );
}

// `policy` is what customers are shown now (null when it's off); `stored`
// is the last one set, kept while it's off so switching it back on brings
// the same cut-offs and refund rules back.
export function PolicyForm({
  policy,
  stored,
  action,
  readOnly,
}: {
  policy: CancellationPolicy | null;
  stored: CancellationPolicy | null;
  action: Action;
  readOnly: boolean;
}) {
  const [on, setOn] = useState(!!policy);
  const shown = policy ?? stored ?? DEFAULT_POLICY;
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
          <Switch
            name="policy_enabled"
            checked={on}
            onChange={(e) => setOn(e.target.checked)}
            description={
              on
                ? "Shown when customers book, and in their emails."
                : "No policy is shown, and refunds are up to you case by case. Your last settings are kept for when you switch it back on."
            }
          >
            Show a cancellation policy
          </Switch>
          {/* Only sent while it's on: nothing hidden can stop a save. */}
          {on && (
            <>
              <div className="grid gap-4 border-t pt-5 @lg:grid-cols-2">
                <Field label="Free cancellation up to" name="cutoff_hours" error={errors.cutoff_hours}>
                  <NumberInput
                    name="cutoff_hours"
                    unit="hours before"
                    min={0}
                    max={720}
                    value={cutoff}
                    onChange={(e) => setCutoff(e.target.value)}
                  />
                </Field>
                <Field label="Change the time up to" name="reschedule_cutoff_hours" error={errors.reschedule_cutoff_hours}>
                  <NumberInput
                    name="reschedule_cutoff_hours"
                    unit="hours before"
                    min={0}
                    max={720}
                    value={move}
                    onChange={(e) => setMove(e.target.value)}
                  />
                </Field>
              </div>
              <div className="grid gap-4 rounded-lg border p-4">
                <Switch
                  name="self_service"
                  checked={selfService}
                  onChange={(e) => setSelfService(e.target.checked)}
                  description="From the link in their confirmation and reminder emails, up to the cut-offs above. You're emailed whenever they do, and any deposit refund is left for you to make."
                >
                  Customers can cancel and change the time themselves
                </Switch>
                {selfService && (
                  <Field
                    label="Changes allowed per booking"
                    name="max_reschedules"
                    error={errors.max_reschedules}
                    hint="1 to 10. Blank for no limit."
                    className="max-w-56"
                  >
                    <NumberInput
                      name="max_reschedules"
                      unit="times"
                      min={1}
                      max={10}
                      placeholder="No limit"
                      value={maxMoves}
                      onChange={(e) => setMaxMoves(e.target.value)}
                    />
                  </Field>
                )}
              </div>
              <Field label="Anything else customers should know" name="note" error={errors.note} hint="Optional. Up to 500 characters.">
                <Textarea
                  name="note"
                  rows={2}
                  maxLength={500}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Bad weather? We'll move you to the next free day at no cost."
                />
              </Field>
              <div className="rounded-lg bg-muted p-4 text-sm">
                <p className="mb-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Customers see</p>
                {policyLines(preview, true).map((line) => (
                  <p key={line}>{line}</p>
                ))}
                <p className="mt-2 text-xs text-muted-foreground">What happens to the deposit is set under Settings → Payments.</p>
              </div>
            </>
          )}
        </>
      )}
    </SaveForm>
  );
}
