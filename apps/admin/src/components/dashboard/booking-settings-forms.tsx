"use client";

import { useState } from "react";
import { extraCarMins, formatDuration, type BookingSettings, type MultiCar, type Resource } from "@leadgen/core/booking/config";
import type { SaveState } from "@/app/app/[tenant]/pricing/actions";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { AddRow, Check, DeleteButton, Field, Row, SaveForm, type Action } from "./form-kit";
import { HoursEditor } from "./hours-editor";
import { Radio } from "@/components/ui/checkbox";

// Settings → Hours & rules: where the business works, when, how jobs are spaced,
// and the vans and bays that do them.

// A bordered block inside a card, headed by the switch that turns it on.
// What's under the switch hides while it's off but is still sent, so
// switching off and saving doesn't lose it.
function SwitchPanel({
  name,
  label,
  description,
  on,
  onChange,
  error,
  children,
}: {
  name: string;
  label: string;
  description: string;
  on: boolean;
  onChange: (on: boolean) => void;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid gap-4 rounded-lg border p-4", on && "bg-muted/20")}>
      <Switch name={name} checked={on} onChange={(e) => onChange(e.target.checked)} description={description}>
        {label}
      </Switch>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className={cn("grid gap-4 border-t pt-4", !on && "hidden")}>{children}</div>
    </div>
  );
}

// ------------------------------------------------------------------ locations

type LocationSettings = Pick<
  BookingSettings,
  "offers_mobile" | "offers_unit" | "base_postcode" | "service_area" | "unit_address" | "unit_postcode"
>;

export function LocationsForm({ settings, action, readOnly }: { settings: LocationSettings; action: Action; readOnly: boolean }) {
  const area = settings.service_area;
  const [mobile, setMobile] = useState(settings.offers_mobile);
  const [unit, setUnit] = useState(settings.offers_unit);
  const [areaType, setAreaType] = useState<"anywhere" | "radius" | "districts" | "territories">(
    "territories" in area ? "territories" : "radius_miles" in area ? "radius" : "districts" in area ? "districts" : "anywhere",
  );
  const areas = [
    ["anywhere", "Anywhere", "Customers anywhere can book a mobile job."],
    ["radius", "Within a distance", "Measured from where your vans start."],
    ["districts", "Certain postcode districts", "Only the districts you list, like BS1 or BS16."],
    ...("territories" in area
      ? ([["territories", `${area.territories.length} territories`, "Drawn on the Coverage Area page; change them there."]] as const)
      : []),
  ] as const;

  return (
    <SaveForm action={action} readOnly={readOnly}>
      {(errors) => (
        <>
          <SwitchPanel
            name="offers_mobile"
            label="Mobile jobs"
            description="You go to the customer's address."
            on={mobile}
            onChange={setMobile}
            error={errors.offers_mobile}
          >
            <Field
              label="Where your vans start from"
              name="base_postcode"
              error={errors.base_postcode}
              hint="A full postcode. Used to measure distances and drive times."
              className="max-w-xs"
            >
              <Input
                name="base_postcode"
                autoComplete="off"
                autoCapitalize="characters"
                placeholder="e.g. BS1 4DJ"
                defaultValue={settings.base_postcode ?? ""}
              />
            </Field>
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-medium">How far you go</legend>
              <div className="grid gap-2 @lg:grid-cols-2">
                {areas.map(([value, label, detail]) => (
                  <Radio
                    key={value}
                    name="area_type"
                    value={value}
                    checked={areaType === value}
                    onChange={() => setAreaType(value)}
                    labelClassName="rounded-lg border p-3 has-checked:border-primary has-checked:bg-primary/5"
                  >
                    <span className="font-medium">{label}</span>
                    <span className="block text-muted-foreground">{detail}</span>
                  </Radio>
                ))}
              </div>
            </fieldset>
            {areaType === "radius" && (
              <Field label="Distance" name="radius_miles" error={errors.radius_miles} className="w-40">
                <NumberInput
                  name="radius_miles"
                  unit="miles"
                  min={1}
                  max={500}
                  defaultValue={"radius_miles" in area ? area.radius_miles : 15}
                />
              </Field>
            )}
            {areaType === "districts" && (
              <Field label="Postcode districts" name="districts" error={errors.districts} hint="Separate them with commas.">
                <Input
                  name="districts"
                  autoComplete="off"
                  autoCapitalize="characters"
                  placeholder="e.g. BS1, BS2, BS16"
                  defaultValue={"districts" in area ? area.districts.join(", ") : ""}
                />
              </Field>
            )}
          </SwitchPanel>

          <SwitchPanel
            name="offers_unit"
            label="Jobs at your shop or unit"
            description="Customers drop the car off with you."
            on={unit}
            onChange={setUnit}
          >
            <div className="grid gap-4 @lg:grid-cols-[minmax(0,1fr)_10rem]">
              <Field label="Address" name="unit_address" error={errors.unit_address}>
                <Input name="unit_address" autoComplete="off" defaultValue={settings.unit_address ?? ""} maxLength={300} />
              </Field>
              <Field label="Postcode" name="unit_postcode" error={errors.unit_postcode}>
                <Input
                  name="unit_postcode"
                  autoComplete="off"
                  autoCapitalize="characters"
                  defaultValue={settings.unit_postcode ?? ""}
                />
              </Field>
            </div>
          </SwitchPanel>
        </>
      )}
    </SaveForm>
  );
}

// ---------------------------------------------------------------------- hours

export function HoursForm({
  settings,
  action,
  readOnly,
}: {
  settings: Pick<BookingSettings, "weekly_hours" | "unit_weekly_hours" | "offers_mobile" | "offers_unit">;
  action: Action;
  readOnly: boolean;
}) {
  const both = settings.offers_mobile && settings.offers_unit;
  const shopOnly = settings.offers_unit && !settings.offers_mobile;
  const [different, setDifferent] = useState(settings.unit_weekly_hours !== null);
  // A shop-only business works its shop hours. If it once had separate ones
  // (from when it did mobile jobs too), those are what customers get, so
  // they're what's shown and edited here; saving makes them the only hours.
  const main = shopOnly ? (settings.unit_weekly_hours ?? settings.weekly_hours) : settings.weekly_hours;
  const title = both ? "Mobile hours" : shopOnly ? "Shop hours" : "Opening hours";

  return (
    <SaveForm action={action} readOnly={readOnly}>
      {(errors) => (
        <>
          <div className="grid gap-3">
            {both && <h3 className="text-sm font-semibold">{title}</h3>}
            <HoursEditor name="mobile_hours" label={title} initial={main} />
            {errors.mobile_hours && (
              <p role="alert" className="text-sm text-destructive">
                {errors.mobile_hours}
              </p>
            )}
          </div>

          {both && (
            <div className="grid gap-3 border-t pt-5">
              <Switch
                name="shop_different"
                checked={different}
                onChange={(e) => setDifferent(e.target.checked)}
                description={different ? undefined : "Shop jobs follow the mobile hours above."}
              >
                Your shop opens at different times
              </Switch>
              {different && (
                <>
                  <h3 className="text-sm font-semibold">Shop hours</h3>
                  <HoursEditor name="shop_hours" label="Shop hours" initial={settings.unit_weekly_hours ?? settings.weekly_hours} />
                  {errors.shop_hours && (
                    <p role="alert" className="text-sm text-destructive">
                      {errors.shop_hours}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </SaveForm>
  );
}

// ---------------------------------------------------------------------- rules

type RuleSettings = Pick<
  BookingSettings,
  | "slot_interval_mins"
  | "min_notice_hours"
  | "max_days_ahead"
  | "travel_buffer_mins"
  | "unit_buffer_mins"
  | "hold_minutes"
  | "offers_unit"
  | "offers_mobile"
>;

const INTERVALS = [5, 10, 15, 20, 30, 45, 60, 90, 120];

function every(mins: number) {
  if (mins === 60) return "Every hour";
  if (mins % 60 === 0) return `Every ${mins / 60} hours`;
  if (mins > 60) return `Every ${Math.floor(mins / 60)} h ${mins % 60} min`;
  return `Every ${mins} minutes`;
}

export function BookingRulesForm({ settings, action, readOnly }: { settings: RuleSettings; action: Action; readOnly: boolean }) {
  const intervals = INTERVALS.includes(settings.slot_interval_mins)
    ? INTERVALS
    : [...INTERVALS, settings.slot_interval_mins].sort((a, b) => a - b);
  return (
    <SaveForm action={action} readOnly={readOnly}>
      {(errors) => (
        <>
          <fieldset className="grid gap-4">
            <legend className="mb-3 text-sm font-semibold">When customers can book</legend>
            <div className="grid gap-4 @lg:grid-cols-3">
              <Field label="Start times" name="slot_interval_mins" error={errors.slot_interval_mins} hint="How often a time is offered.">
                <Select name="slot_interval_mins" defaultValue={settings.slot_interval_mins}>
                  {intervals.map((m) => (
                    <option key={m} value={m}>
                      {every(m)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Notice needed" name="min_notice_hours" error={errors.min_notice_hours} hint="0 lets them book the next free time.">
                <NumberInput name="min_notice_hours" unit="hours" min={0} max={720} defaultValue={settings.min_notice_hours} />
              </Field>
              <Field label="Book up to" name="max_days_ahead" error={errors.max_days_ahead} hint="How far ahead the calendar goes.">
                <NumberInput name="max_days_ahead" unit="days ahead" min={1} max={365} defaultValue={settings.max_days_ahead} />
              </Field>
            </div>
          </fieldset>

          <fieldset className="grid gap-4 border-t pt-5">
            <legend className="sr-only">Gaps between jobs</legend>
            <p className="text-sm font-semibold">Gaps between jobs</p>
            <div className="grid gap-4 @lg:grid-cols-2">
              <Field
                label="Between mobile jobs, at least"
                name="travel_buffer_mins"
                error={errors.travel_buffer_mins}
                hint="Or the estimated drive between the two postcodes, if that's longer."
                className={cn(!settings.offers_mobile && "hidden")}
              >
                <NumberInput name="travel_buffer_mins" unit="minutes" min={0} max={480} defaultValue={settings.travel_buffer_mins} />
              </Field>
              <Field
                label="Between shop jobs"
                name="unit_buffer_mins"
                error={errors.unit_buffer_mins}
                hint="Time to turn the bay round."
                className={cn(!settings.offers_unit && "hidden")}
              >
                <NumberInput name="unit_buffer_mins" unit="minutes" min={0} max={480} defaultValue={settings.unit_buffer_mins} />
              </Field>
            </div>
            <p className="text-sm text-muted-foreground">Each van or bay is spaced on its own.</p>
          </fieldset>

          <div className="grid gap-4 border-t pt-5">
            <Field
              label="Keep the time reserved while they pay"
              name="hold_minutes"
              error={errors.hold_minutes}
              hint="At least 35 minutes when a deposit is paid online."
              className="max-w-56"
            >
              <NumberInput name="hold_minutes" unit="minutes" min={5} max={120} defaultValue={settings.hold_minutes} />
            </Field>
          </div>
        </>
      )}
    </SaveForm>
  );
}

// --------------------------------------------------------- more than one car

export function MultiCarForm({ settings, action, readOnly }: { settings: MultiCar; action: Action; readOnly: boolean }) {
  const [on, setOn] = useState(settings.enabled);
  const [setup, setSetup] = useState(String(settings.setup_mins));
  const saved = Math.min(Math.max(Number(setup) || 0, 0), 240);
  // A worked example, so the number means something: two 2-hour valets.
  const one = 120;
  const together = one + extraCarMins(one, saved);
  return (
    <SaveForm action={action} readOnly={readOnly}>
      {(errors) => (
        <SwitchPanel
          name="multi_car_enabled"
          label="Customers can book more than one car"
          description="For households and fleets: the cars are done one after another on the same visit."
          on={on}
          onChange={setOn}
        >
          <div className="grid gap-4 @lg:grid-cols-2">
            <Field label="Cars per booking" name="max_cars" error={errors.max_cars}>
              <Select name="max_cars" defaultValue={settings.max_cars}>
                {[2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    Up to {n} cars
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Time saved on each extra car"
              name="setup_mins"
              error={errors.setup_mins}
              hint="Getting the kit out, setting up and packing away happen once, so each car after the first takes this much less."
            >
              <NumberInput
                name="setup_mins"
                unit="minutes"
                min={0}
                max={240}
                value={setup}
                onChange={(e) => setSetup(e.target.value)}
              />
            </Field>
          </div>
          <div className="grid gap-1 rounded-lg bg-muted/60 p-4">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">For example</p>
            <p>
              Two cars that each take {formatDuration(one)} are booked as one visit of{" "}
              <span className="font-semibold">{formatDuration(together)}</span>
              {together < one * 2 && <span className="text-muted-foreground"> instead of {formatDuration(one * 2)}</span>}.
            </p>
            <p className="text-muted-foreground">
              There&apos;s one journey and one call-out charge for the visit. A car never takes less than half its own time.
              Each car gets its own service, size and extras, and you confirm the price of cars after the first when you see
              them if your prices depend on condition.
            </p>
          </div>
        </SwitchPanel>
      )}
    </SaveForm>
  );
}

// ------------------------------------------------------------ vans and bays

export type EditableResource = Resource & { active: boolean };

const KIND: Record<string, string> = { mobile: "Mobile", unit: "Shop" };

export function ResourceEditor({
  resource,
  action,
  deleteAction,
  readOnly,
}: {
  resource: EditableResource;
  action: Action;
  deleteAction: () => Promise<SaveState>;
  readOnly: boolean;
}) {
  return (
    <Row
      title={resource.name}
      hidden={!resource.active}
      summary={`${resource.location_types.map((t) => KIND[t]).join(" and ")} · ${resource.weekly_hours ? "Its own hours" : "Business hours"}`}
    >
      <SaveForm
        action={action}
        readOnly={readOnly}
        extra={
          <DeleteButton
            what={resource.name}
            note="If it has bookings on record it can't be deleted; switch it off instead."
            action={deleteAction}
          />
        }
      >
        {(errors) => <ResourceFields resource={resource} errors={errors} />}
      </SaveForm>
    </Row>
  );
}

export function NewResource({ action, readOnly, suggestion }: { action: Action; readOnly: boolean; suggestion: string }) {
  if (readOnly) return null;
  return (
    <AddRow label="Add a van or bay">
      {(close) => (
        <SaveForm action={action} resetOnSave onSaved={close} submitLabel="Add" savedText="Added.">
          {(errors) => <ResourceFields errors={errors} suggestion={suggestion} />}
        </SaveForm>
      )}
    </AddRow>
  );
}

function ResourceFields({
  resource,
  errors,
  suggestion,
}: {
  resource?: EditableResource;
  errors: Record<string, string | undefined>;
  suggestion?: string;
}) {
  const [custom, setCustom] = useState(Boolean(resource?.weekly_hours));
  return (
    <>
      <Field label="Name" name="name" error={errors.name} className="max-w-sm">
        <Input name="name" autoComplete="off" placeholder={suggestion} defaultValue={resource?.name ?? suggestion ?? ""} maxLength={60} />
      </Field>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Where it works</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Check name="location_mobile" label="Out on mobile jobs" defaultChecked={resource?.location_types.includes("mobile") ?? true} />
          <Check name="location_unit" label="At the shop" defaultChecked={resource?.location_types.includes("unit") ?? false} />
        </div>
        {errors.location_mobile && (
          <p role="alert" className="text-sm text-destructive">
            {errors.location_mobile}
          </p>
        )}
      </fieldset>

      <div className="grid gap-3 border-t pt-4">
        <Switch
          name="custom_hours"
          checked={custom}
          onChange={(e) => setCustom(e.target.checked)}
          description={custom ? undefined : "Off: it follows the business's opening hours."}
        >
          Its own hours
        </Switch>
        {custom && (
          <>
            <HoursEditor name="hours" label={`Hours for ${resource?.name ?? "this one"}`} initial={resource?.weekly_hours ?? {}} />
            {errors.hours && (
              <p role="alert" className="text-sm text-destructive">
                {errors.hours}
              </p>
            )}
          </>
        )}
      </div>

      <div className="border-t pt-4">
        <Switch
          name="active"
          defaultChecked={resource?.active ?? true}
          description="Off stops new bookings without losing its history."
        >
          Taking bookings
        </Switch>
      </div>
    </>
  );
}
