"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { formatDuration, formatPence, type ConditionTier } from "@leadgen/core/booking/config";
import type { SaveState } from "@/app/app/[tenant]/pricing/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { poundsInput, type EditableAddOn, type EditableService, type PricingRules } from "@/lib/pricing-fields";
import { cn } from "@/lib/utils";
import {
  AddRow,
  Check,
  DeleteButton,
  Field,
  Row,
  SaveForm,
  fieldClass,
  type Action,
  type Errors,
} from "./form-kit";

// ------------------------------------------------------------------ extras

export function AddOnEditor({
  addOn,
  services,
  action,
  deleteAction,
  readOnly,
}: {
  addOn: EditableAddOn;
  services: EditableService[];
  action: Action;
  deleteAction: () => Promise<SaveState>;
  readOnly: boolean;
}) {
  const goesWith = addOn.service_ids
    ? services.filter((s) => addOn.service_ids!.includes(s.id)).map((s) => s.name).join(", ") || "no services"
    : "all services";
  return (
    <Row
      title={addOn.name}
      hidden={!addOn.active}
      summary={`+${formatPence(addOn.price_pence)}${addOn.duration_mins ? ` · +${formatDuration(addOn.duration_mins)}` : ""} · ${goesWith}`}
    >
      <SaveForm action={action} readOnly={readOnly} extra={<DeleteButton what={addOn.name} action={deleteAction} />}>
        {(errors) => <AddOnFields addOn={addOn} services={services} errors={errors} />}
      </SaveForm>
    </Row>
  );
}

export function NewAddOn({ services, action, readOnly }: { services: EditableService[]; action: Action; readOnly: boolean }) {
  if (readOnly) return null;
  return (
    <AddRow label="Add an extra">
      {(close) => (
        <SaveForm action={action} resetOnSave onSaved={close} submitLabel="Add extra">
          {(errors) => <AddOnFields services={services} errors={errors} />}
        </SaveForm>
      )}
    </AddRow>
  );
}

function AddOnFields({ addOn, services, errors }: { addOn?: EditableAddOn; services: EditableService[]; errors: Errors }) {
  const [some, setSome] = useState(Boolean(addOn?.service_ids));
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem_8rem]">
        <Field label="Name" name="name" error={errors.name}>
          <Input name="name" defaultValue={addOn?.name} />
        </Field>
        <Field label="Price (£)" name="price" error={errors.price}>
          <Input name="price" inputMode="decimal" defaultValue={addOn ? poundsInput(addOn.price_pence) : ""} />
        </Field>
        <Field label="Extra mins" name="duration_mins" error={errors.duration_mins}>
          <Input name="duration_mins" inputMode="numeric" defaultValue={addOn?.duration_mins || ""} placeholder="0" />
        </Field>
      </div>
      <Field label="Description" name="description" error={errors.description}>
        <textarea name="description" rows={2} defaultValue={addOn?.description ?? ""} className={cn(fieldClass, "py-2")} />
      </Field>
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Goes with</legend>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name="applies_to" value="all" checked={!some} onChange={() => setSome(false)} className="accent-primary" />
            Every service
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="applies_to" value="some" checked={some} onChange={() => setSome(true)} className="accent-primary" />
            Only some
          </label>
        </div>
        {some && (
          <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-lg border p-3">
            {services.map((s) => (
              <Check
                key={s.id}
                name="service_ids"
                value={s.id}
                label={s.name}
                defaultChecked={addOn?.service_ids?.includes(s.id) ?? false}
              />
            ))}
          </div>
        )}
        {errors.service_ids && <p className="text-sm text-destructive">{errors.service_ids}</p>}
      </fieldset>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <Check name="active" label="Show on booking page" defaultChecked={addOn?.active ?? true} />
        <Field label="Order" name="sort_order" error={errors.sort_order} className="w-20">
          <Input name="sort_order" inputMode="numeric" defaultValue={addOn?.sort_order ?? 0} />
        </Field>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ rules

type TierRow = { key: string; label: string; uplift: string; extraMins: string; needsInspection: boolean };

function toRows(tiers: ConditionTier[]): TierRow[] {
  return tiers.map((t) => ({
    key: t.key,
    label: t.label,
    uplift: String(Math.round((t.multiplier - 1) * 1000) / 10),
    extraMins: String(t.extra_mins),
    needsInspection: t.needs_inspection,
  }));
}

function slugify(label: string) {
  return label.split(":")[0].toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "level";
}

export function RulesForm({ rules, action, readOnly }: { rules: PricingRules; action: Action; readOnly: boolean }) {
  const [tiers, setTiers] = useState<TierRow[]>(() => toRows(rules.condition_tiers));
  const update = (i: number, patch: Partial<TierRow>) =>
    setTiers((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  // Keys stay fixed once made, so old quotes still match; new levels get
  // one from their label.
  const serialised = JSON.stringify(
    tiers
      .filter((t) => t.label.trim())
      .map((t, i, all) => {
        let key = t.key || slugify(t.label);
        if (all.some((o, j) => j < i && (o.key || slugify(o.label)) === key)) key = `${key}_${i}`;
        return {
          key,
          label: t.label.trim(),
          multiplier: 1 + (Number(t.uplift) || 0) / 100,
          extra_mins: Math.max(0, Math.round(Number(t.extraMins) || 0)),
          needs_inspection: t.needsInspection,
        };
      }),
  );

  return (
    <SaveForm action={action} readOnly={readOnly} submitLabel="Save pricing rules">
      {(errors) => (
        <>
          <input type="hidden" name="condition_tiers" value={serialised} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Minimum charge (£)" name="min_price" error={errors.min_price}>
              <Input name="min_price" inputMode="decimal" placeholder="0" defaultValue={rules.min_price_pence ? poundsInput(rules.min_price_pence) : ""} />
            </Field>
            {rules.offers_mobile && (
              <Field label="Mobile call-out fee (£)" name="mobile_surcharge" error={errors.mobile_surcharge}>
                <Input
                  name="mobile_surcharge"
                  inputMode="decimal"
                  placeholder="0"
                  defaultValue={rules.mobile_surcharge_pence ? poundsInput(rules.mobile_surcharge_pence) : ""}
                />
              </Field>
            )}
          </div>

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">Condition levels</legend>
            <p className="mb-2 text-sm text-muted-foreground">
              Customers aren&apos;t asked: the photos they add while booking are checked against these levels, so
              describe what each one looks like, as &ldquo;Label: description&rdquo;. The uplift is added to the
              service and size price (not extras), rounded to the pound. Without photos, or if they don&apos;t show
              enough, the job is booked with no uplift and marked for you to check the car. With no levels, photos
              aren&apos;t checked.
            </p>
            {tiers.length > 0 && (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Label</th>
                      <th className="px-3 py-2 font-medium">Uplift %</th>
                      <th className="px-3 py-2 font-medium">Extra mins</th>
                      <th className="px-3 py-2 font-medium">Owner prices it</th>
                      <th className="sr-only">Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {tiers.map((t, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5">
                          <Input
                            value={t.label}
                            onChange={(e) => update(i, { label: e.target.value })}
                            aria-label="Label"
                            className="min-w-56"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <Input
                            value={t.uplift}
                            inputMode="decimal"
                            onChange={(e) => update(i, { uplift: e.target.value })}
                            aria-label="Uplift percent"
                            disabled={t.needsInspection}
                            className="w-20"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <Input
                            value={t.extraMins}
                            inputMode="numeric"
                            onChange={(e) => update(i, { extraMins: e.target.value })}
                            aria-label="Extra minutes"
                            disabled={t.needsInspection}
                            className="w-20"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="checkbox"
                            checked={t.needsInspection}
                            onChange={(e) => update(i, { needsInspection: e.target.checked })}
                            aria-label="Needs inspection before pricing"
                            className="size-4 accent-primary"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remove ${t.label || "level"}`}
                            onClick={() => setTiers((rows) => rows.filter((_, j) => j !== i))}
                          >
                            <X />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="justify-self-start"
              onClick={() => setTiers((rows) => [...rows, { key: "", label: "", uplift: "0", extraMins: "0", needsInspection: false }])}
            >
              <Plus /> Add condition level
            </Button>
            {errors.condition_tiers && <p className="text-sm text-destructive">{errors.condition_tiers}</p>}
          </fieldset>
        </>
      )}
    </SaveForm>
  );
}
