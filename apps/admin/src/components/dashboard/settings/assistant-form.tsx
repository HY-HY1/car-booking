"use client";

import { useState } from "react";
import { ASSISTANT_MODES, ASSISTANT_TONES, type AssistantSettings } from "@leadgen/core/settings/assistant";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Check, Field, SaveForm, fieldClass, type Action } from "../form-kit";

// Settings → AI assistant.

function poundsInput(pence: number | null) {
  if (pence === null) return "";
  return pence % 100 === 0 ? String(pence / 100) : (pence / 100).toFixed(2);
}

export function AssistantForm({
  settings,
  businessName,
  action,
  readOnly,
}: {
  settings: AssistantSettings;
  businessName: string;
  action: Action;
  readOnly: boolean;
}) {
  const [followUp, setFollowUp] = useState(settings.follow_up.enabled);
  return (
    <SaveForm action={action} readOnly={readOnly} sticky savedText="Saved.">
      {(errors) => (
        <>
          <Check name="enabled" label="Let the assistant reply to customers" defaultChecked={settings.enabled} />

          <fieldset className="grid gap-3">
            <legend className="mb-2 text-sm font-medium">What it handles</legend>
            {Object.entries(ASSISTANT_MODES).map(([k, m]) => (
              <label key={k} className="flex items-start gap-2 text-sm">
                <input type="radio" name="mode" value={k} defaultChecked={settings.mode === k} className="mt-0.5 size-4 accent-primary" />
                <span>
                  {m.label}
                  <span className="block text-muted-foreground">{m.detail}</span>
                </span>
              </label>
            ))}
            {errors.mode && <p className="text-sm text-destructive">{errors.mode}</p>}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tone" name="tone" error={errors.tone}>
              <select name="tone" defaultValue={settings.tone} className={cn(fieldClass, "h-8")}>
                {Object.entries(ASSISTANT_TONES).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Signs off as" name="sign_off" error={errors.sign_off}>
              <Input name="sign_off" defaultValue={settings.sign_off ?? ""} placeholder={businessName} maxLength={60} />
            </Field>
          </div>

          <fieldset className="grid gap-3">
            <legend className="mb-2 text-sm font-medium">Following up enquiries that don&apos;t book</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="follow_up_enabled"
                checked={followUp}
                onChange={(e) => setFollowUp(e.target.checked)}
                className="size-4 accent-primary"
              />
              Chase them up
            </label>
            <div className={cn("grid gap-4 sm:grid-cols-3", !followUp && "opacity-60")}>
              <Field label="First nudge after (hours)" name="first_after_hours" error={errors.first_after_hours}>
                <Input name="first_after_hours" inputMode="numeric" defaultValue={settings.follow_up.first_after_hours} />
              </Field>
              <Field label="Then every (days)" name="gap_days" error={errors.gap_days}>
                <Input name="gap_days" inputMode="numeric" defaultValue={settings.follow_up.gap_days} />
              </Field>
              <Field label="Stop after (messages)" name="max_attempts" error={errors.max_attempts}>
                <Input name="max_attempts" inputMode="numeric" defaultValue={settings.follow_up.max_attempts} />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">
              It stops straight away if they book, reply, or ask not to be contacted.
            </p>
          </fieldset>

          <fieldset className="grid gap-3">
            <legend className="mb-2 text-sm font-medium">When it hands over to you</legend>
            <p className="text-sm">Always, when a customer asks to speak to a person.</p>
            <Check name="handoff_low_confidence" label="When it isn't sure of the size or condition" defaultChecked={settings.handoff.low_confidence} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Jobs over (£), blank for no limit" name="handoff_over_price" error={errors.handoff_over_price}>
                <Input name="handoff_over_price" inputMode="decimal" defaultValue={poundsInput(settings.handoff.over_price_pence)} placeholder="No limit" />
              </Field>
              <Field label="It won't quote over (£) without you" name="max_quote" error={errors.max_quote}>
                <Input name="max_quote" inputMode="decimal" defaultValue={poundsInput(settings.max_quote_pence)} placeholder="No limit" />
              </Field>
            </div>
            <Field label="Messages mentioning these words (comma separated)" name="handoff_keywords" error={errors.handoff_keywords}>
              <Input
                name="handoff_keywords"
                defaultValue={settings.handoff.keywords.join(", ")}
                placeholder="complaint, lease return, fleet"
              />
            </Field>
          </fieldset>
        </>
      )}
    </SaveForm>
  );
}
