"use client";

import { useState } from "react";
import type { BookingSettings, Resource } from "@leadgen/core/booking/config";
import type { SaveState } from "@/app/app/[tenant]/pricing/actions";
import { Input } from "@/components/ui/input";
import { AddRow, Check, DeleteButton, Field, Row, SaveForm, type Action } from "./form-kit";
import { HoursEditor } from "./hours-editor";

// Settings → Booking: where the business works, when, how jobs are spaced,
// and the vans and bays that do them.

// ------------------------------------------------------------------ locations

type LocationSettings = Pick<
  BookingSettings,
  "offers_mobile" | "offers_unit" | "base_postcode" | "service_area" | "unit_address" | "unit_postcode"
>;

export function LocationsForm({ settings, action, readOnly }: { settings: LocationSettings; action: Action; readOnly: boolean }) {
  const area = settings.service_area;
  const [areaType, setAreaType] = useState<"anywhere" | "radius" | "districts" | "territories">(
    "territories" in area ? "territories" : "radius_miles" in area ? "radius" : "districts" in area ? "districts" : "anywhere",
  );

  return (
    <SaveForm action={action} readOnly={readOnly}>
      {(errors) => (
        <>
          <fieldset className="grid gap-4 rounded-xl border p-4">
            <legend className="px-1 text-sm font-medium">At the customer&apos;s address (mobile)</legend>
            <Check name="offers_mobile" label="Take mobile jobs" defaultChecked={settings.offers_mobile} />
            {errors.offers_mobile && <p className="text-sm text-destructive">{errors.offers_mobile}</p>}
            <Field label="Where your vans start from (postcode)" name="base_postcode" error={errors.base_postcode} className="max-w-xs">
              <Input name="base_postcode" autoComplete="off" placeholder="BS1 4DJ" defaultValue={settings.base_postcode ?? ""} />
            </Field>

            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">How far you go</legend>
              {(
                [
                  ["anywhere", "Anywhere"],
                  ["radius", "Within a distance of that postcode"],
                  ["districts", "Only certain postcode districts"],
                  ...("territories" in area
                    ? ([["territories", `${area.territories.length} territories (change them on the Coverage Area page)`]] as const)
                    : []),
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="area_type"
                    value={value}
                    checked={areaType === value}
                    onChange={() => setAreaType(value)}
                    className="size-4 accent-primary"
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            {areaType === "radius" && (
              <Field label="Miles" name="radius_miles" error={errors.radius_miles} className="w-32">
                <Input
                  name="radius_miles"
                  inputMode="numeric"
                  defaultValue={"radius_miles" in area ? area.radius_miles : 15}
                />
              </Field>
            )}
            {areaType === "districts" && (
              <Field label="Postcode districts" name="districts" error={errors.districts}>
                <Input
                  name="districts"
                  autoComplete="off"
                  placeholder="BS1, BS2, BS16"
                  defaultValue={"districts" in area ? area.districts.join(", ") : ""}
                />
              </Field>
            )}
          </fieldset>

          <fieldset className="grid gap-4 rounded-xl border p-4">
            <legend className="px-1 text-sm font-medium">At your shop or unit</legend>
            <Check name="offers_unit" label="Take jobs at my shop (customers drop the car off)" defaultChecked={settings.offers_unit} />
            <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
              <Field label="Address" name="unit_address" error={errors.unit_address}>
                <Input name="unit_address" autoComplete="off" defaultValue={settings.unit_address ?? ""} />
              </Field>
              <Field label="Postcode" name="unit_postcode" error={errors.unit_postcode}>
                <Input name="unit_postcode" autoComplete="off" defaultValue={settings.unit_postcode ?? ""} />
              </Field>
            </div>
          </fieldset>
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
  const [different, setDifferent] = useState(settings.unit_weekly_hours !== null);

  return (
    <SaveForm action={action} readOnly={readOnly}>
      {(errors) => (
        <>
          <div className="grid gap-2">
            <h3 className="text-sm font-medium">{both ? "Mobile hours" : settings.offers_unit ? "Shop hours" : "Opening hours"}</h3>
            <HoursEditor
              name="mobile_hours"
              label={both ? "Mobile hours" : "Opening hours"}
              initial={settings.weekly_hours}
            />
            {errors.mobile_hours && <p className="text-sm text-destructive">{errors.mobile_hours}</p>}
          </div>

          {both && (
            <div className="grid gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="shop_different"
                  checked={different}
                  onChange={(e) => setDifferent(e.target.checked)}
                  className="size-4 accent-primary"
                />
                My shop opens at different times
              </label>
              {different ? (
                <>
                  <h3 className="text-sm font-medium">Shop hours</h3>
                  <HoursEditor name="shop_hours" label="Shop hours" initial={settings.unit_weekly_hours ?? settings.weekly_hours} />
                  {errors.shop_hours && <p className="text-sm text-destructive">{errors.shop_hours}</p>}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Shop jobs follow the mobile hours above.</p>
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
>;

export function BookingRulesForm({ settings, action, readOnly }: { settings: RuleSettings; action: Action; readOnly: boolean }) {
  return (
    <SaveForm action={action} readOnly={readOnly}>
      {(errors) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start times every (minutes)" name="slot_interval_mins" error={errors.slot_interval_mins}>
            <Input name="slot_interval_mins" inputMode="numeric" defaultValue={settings.slot_interval_mins} />
          </Field>
          <Field label="Notice needed (hours)" name="min_notice_hours" error={errors.min_notice_hours}>
            <Input name="min_notice_hours" inputMode="numeric" defaultValue={settings.min_notice_hours} />
          </Field>
          <Field label="Book up to (days ahead)" name="max_days_ahead" error={errors.max_days_ahead}>
            <Input name="max_days_ahead" inputMode="numeric" defaultValue={settings.max_days_ahead} />
          </Field>
          <Field label="Hold a slot while paying (minutes)" name="hold_minutes" error={errors.hold_minutes}>
            <Input name="hold_minutes" inputMode="numeric" defaultValue={settings.hold_minutes} />
          </Field>
          <Field label="Minimum gap between mobile jobs (minutes)" name="travel_buffer_mins" error={errors.travel_buffer_mins}>
            <Input name="travel_buffer_mins" inputMode="numeric" defaultValue={settings.travel_buffer_mins} />
          </Field>
          <Field label="Gap between shop jobs (minutes)" name="unit_buffer_mins" error={errors.unit_buffer_mins}>
            <Input name="unit_buffer_mins" inputMode="numeric" defaultValue={settings.unit_buffer_mins} />
          </Field>
          <p className="text-sm text-muted-foreground sm:col-span-2">
            For mobile jobs the gap is the longer of this and the estimated drive between the two postcodes. Each van
            or bay is spaced on its own. Holds are lengthened to at least 35 minutes when a deposit is paid online.
          </p>
        </div>
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
      summary={`${resource.location_types.map((t) => KIND[t]).join(" and ")} · ${resource.weekly_hours ? "Own hours" : "Business hours"}`}
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
        <SaveForm action={action} resetOnSave onSaved={close} submitLabel="Add">
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
      <div className="grid gap-4 sm:grid-cols-[1fr_6rem]">
        <Field label="Name" name="name" error={errors.name}>
          <Input name="name" autoComplete="off" placeholder={suggestion} defaultValue={resource?.name ?? suggestion ?? ""} />
        </Field>
        <Field label="Order" name="sort_order" error={errors.sort_order}>
          <Input name="sort_order" inputMode="numeric" placeholder="Last" defaultValue={resource?.sort_order ?? ""} />
        </Field>
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Where it works</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Check name="location_mobile" label="Out on mobile jobs" defaultChecked={resource?.location_types.includes("mobile") ?? true} />
          <Check name="location_unit" label="At the shop" defaultChecked={resource?.location_types.includes("unit") ?? false} />
        </div>
        {errors.location_mobile && <p className="text-sm text-destructive">{errors.location_mobile}</p>}
      </fieldset>

      <div className="grid gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="custom_hours"
            checked={custom}
            onChange={(e) => setCustom(e.target.checked)}
            className="size-4 accent-primary"
          />
          Its own hours (otherwise it follows the business hours)
        </label>
        {custom && (
          <>
            <HoursEditor name="hours" label="Hours for this one" initial={resource?.weekly_hours ?? {}} />
            {errors.hours && <p className="text-sm text-destructive">{errors.hours}</p>}
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Check name="active" label="Taking bookings" defaultChecked={resource?.active ?? true} />
        <span className="text-sm text-muted-foreground">Untick to stop new bookings without losing its history.</span>
      </div>
    </>
  );
}
