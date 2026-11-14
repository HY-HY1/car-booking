"use client";

import { useState } from "react";
import { ASSISTANT_MODES, ASSISTANT_TONES, type AssistantSettings } from "@leadgen/core/settings/assistant";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { cn } from "@/lib/utils";
import { Field, SaveForm, type Action } from "../form-kit";
import { Select } from "@/components/ui/select";
import { Radio } from "@/components/ui/checkbox";
import { NumberInput } from "@/components/ui/number-input";
import { Switch } from "@/components/ui/switch";

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
    <SaveForm action={action} readOnly={readOnly} savedText="Saved.">
      {(errors) => (
        <>
          <Switch name="enabled" defaultChecked={settings.enabled} description="Replies to new enquiries as your business.">
            Let the assistant reply to customers
          </Switch>

          <fieldset className="grid gap-3">
            <legend className="mb-2 text-sm font-semibold">What it handles</legend>
            {Object.entries(ASSISTANT_MODES).map(([k, m]) => (
              <Radio
                key={k}
                name="mode"
                value={k}
                defaultChecked={settings.mode === k}
                labelClassName="rounded-lg border p-3 has-checked:border-primary has-checked:bg-primary/5"
              >
                <span className="font-medium">{m.label}</span>
                <span className="block text-muted-foreground">{m.detail}</span>
              </Radio>
            ))}
            {errors.mode && <p className="text-sm text-destructive">{errors.mode}</p>}
          </fieldset>

          <div className="grid gap-4 border-t pt-5 @lg:grid-cols-2">
            <Field label="Tone" name="tone" error={errors.tone}>
              <Select name="tone" defaultValue={settings.tone}>
                {Object.entries(ASSISTANT_TONES).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Signs off as" name="sign_off" error={errors.sign_off}>
              <Input name="sign_off" defaultValue={settings.sign_off ?? ""} placeholder={businessName} maxLength={60} />
            </Field>
          </div>

          <div className="grid gap-4 border-t pt-5">
            <Switch
              name="follow_up_enabled"
              checked={followUp}
              onChange={(e) => setFollowUp(e.target.checked)}
              description="Follows up enquiries that don't book."
            >
              Chase them up
            </Switch>
            <div className={cn("grid gap-4 @lg:grid-cols-3", !followUp && "hidden")}>
              <Field label="First nudge after" name="first_after_hours" error={errors.first_after_hours}>
                <NumberInput name="first_after_hours" unit="hours" min={1} max={168} defaultValue={settings.follow_up.first_after_hours} />
              </Field>
              <Field label="Then every" name="gap_days" error={errors.gap_days}>
                <NumberInput name="gap_days" unit="days" min={1} max={14} defaultValue={settings.follow_up.gap_days} />
              </Field>
              <Field label="Stop after" name="max_attempts" error={errors.max_attempts}>
                <NumberInput name="max_attempts" unit="messages" min={1} max={5} defaultValue={settings.follow_up.max_attempts} />
              </Field>
            </div>
            <p className="text-sm text-muted-foreground">
              It stops straight away if they book, reply, or ask not to be contacted.
            </p>
          </div>

          <fieldset className="grid gap-4 border-t pt-5">
            <legend className="sr-only">When it hands over to you</legend>
            <div className="grid gap-0.5">
              <p className="text-sm font-semibold">When it hands over to you</p>
              <p className="text-sm text-muted-foreground">Always, when a customer asks to speak to a person.</p>
            </div>
            <Switch name="handoff_low_confidence" defaultChecked={settings.handoff.low_confidence}>
              When it isn&apos;t sure of the size or condition
            </Switch>
            <div className="grid gap-4 @lg:grid-cols-2">
              <Field label="Jobs over" name="handoff_over_price" error={errors.handoff_over_price} hint="Blank for no limit.">
                <MoneyInput name="handoff_over_price" inputMode="decimal" defaultValue={poundsInput(settings.handoff.over_price_pence)} placeholder="No limit" />
              </Field>
              <Field label="It won't quote over this without you" name="max_quote" error={errors.max_quote} hint="Blank for no limit.">
                <MoneyInput name="max_quote" inputMode="decimal" defaultValue={poundsInput(settings.max_quote_pence)} placeholder="No limit" />
              </Field>
            </div>
            <Field label="Messages mentioning these words" name="handoff_keywords" error={errors.handoff_keywords} hint="Separate them with commas.">
              <Input
                name="handoff_keywords"
                defaultValue={settings.handoff.keywords.join(", ")}
                placeholder="e.g. complaint, lease return, fleet"
              />
            </Field>
          </fieldset>
        </>
      )}
    </SaveForm>
  );
}
