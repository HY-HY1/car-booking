"use client";

import { SIZE_CLASSES, addOnFitsService, type AddOn, type Service, type SizeClass } from "@leadgen/core/booking/config";
import { useState } from "react";
import type { SaveState } from "@/app/app/[tenant]/pricing/actions";
import { Field, SaveForm } from "@/components/dashboard/form-kit";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Select } from "@/components/ui/select";

const SIZES = Object.keys(SIZE_CLASSES) as SizeClass[];

export type EditValues = {
  serviceId: string;
  sizeClass: SizeClass;
  addOnIds: string[];
  addressLine: string;
  postcode: string;
  resourceId: string;
  staffId: string;
  price: string;
  durationMins: number;
};

// Changing a job after it's booked. The price and length stay as they are
// unless changed here, or the box asks for the price list's.
export function EditBookingForm({
  action,
  services,
  addOns,
  resources,
  staff,
  locationType,
  values,
}: {
  action: (formData: FormData) => Promise<SaveState>;
  services: Service[];
  addOns: AddOn[];
  resources: { id: string; name: string }[];
  staff: { id: string; name: string }[];
  locationType: "mobile" | "unit";
  values: EditValues;
}) {
  const [serviceId, setServiceId] = useState(values.serviceId);
  const [addOnIds, setAddOnIds] = useState(values.addOnIds);
  const [recalculate, setRecalculate] = useState(false);
  const fitting = addOns.filter((a) => addOnFitsService(a, serviceId));

  return (
    <SaveForm action={action} submitLabel="Save changes" savedText="Booking updated. The customer hasn't been emailed.">
      {(errors) => (
        <>
          <input type="hidden" name="add_on_ids" value={addOnIds.filter((id) => fitting.some((a) => a.id === id)).join(",")} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Service" name="service_id" error={errors.service_id}>
              <Select name="service_id" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Car size" name="size_class" error={errors.size_class}>
              <Select name="size_class" defaultValue={values.sizeClass}>
                {SIZES.map((s) => (
                  <option key={s} value={s}>
                    {SIZE_CLASSES[s]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {fitting.length > 0 && (
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">Extras</legend>
              {fitting.map((a) => (
                <Checkbox
                  key={a.id}
                  checked={addOnIds.includes(a.id)}
                  onChange={(e) => setAddOnIds(e.target.checked ? [...addOnIds, a.id] : addOnIds.filter((id) => id !== a.id))}
                >
                  {a.name}
                </Checkbox>
              ))}
            </fieldset>
          )}

          {locationType === "mobile" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Address" name="address_line" error={errors.address_line}>
                <Input name="address_line" defaultValue={values.addressLine} autoComplete="off" />
              </Field>
              <Field label="Postcode" name="postcode" error={errors.postcode}>
                <Input name="postcode" defaultValue={values.postcode} autoComplete="off" />
              </Field>
            </div>
          ) : (
            <input type="hidden" name="postcode" value={values.postcode} />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Van or bay" name="resource_id" error={errors.resource_id}>
              <Select name="resource_id" defaultValue={values.resourceId}>
                {resources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Who's doing it" name="staff_id" error={errors.staff_id}>
              <Select name="staff_id" defaultValue={values.staffId}>
                <option value="">Not assigned</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Checkbox name="recalculate" checked={recalculate} onChange={(e) => setRecalculate(e.target.checked)}>
            <span>
              Use the price list for the price and length
              <span className="block text-muted-foreground">Leave this off to keep what you&apos;ve agreed with the customer.</span>
            </span>
          </Checkbox>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Price" name="price" error={errors.price}>
              <MoneyInput name="price" inputMode="decimal" defaultValue={values.price} disabled={recalculate} />
            </Field>
            <Field label="Length (mins)" name="duration_mins" error={errors.duration_mins}>
              <Input name="duration_mins" inputMode="numeric" defaultValue={values.durationMins} disabled={recalculate} />
            </Field>
          </div>
        </>
      )}
    </SaveForm>
  );
}

// A second (or third) car on the same booking.
export function ExtraCarForm({ action }: { action: (formData: FormData) => Promise<SaveState> }) {
  return (
    <SaveForm action={action} submitLabel="Add this car" savedText="Car added to the booking." resetOnSave>
      {(errors) => (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Make" name="make" error={errors.make}>
              <Input name="make" autoComplete="off" />
            </Field>
            <Field label="Model" name="model" error={errors.model}>
              <Input name="model" autoComplete="off" />
            </Field>
            <Field label="Registration" name="registration" error={errors.registration}>
              <Input name="registration" autoComplete="off" className="font-mono uppercase" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Size" name="size_class" error={errors.size_class}>
              <Select name="size_class" defaultValue="">
                <option value="">Not sure</option>
                {SIZES.map((s) => (
                  <option key={s} value={s}>
                    {SIZE_CLASSES[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Adds to the price" name="price" error={errors.price}>
              <MoneyInput name="price" inputMode="decimal" />
            </Field>
            <Field label="Adds (mins)" name="extra_mins" error={errors.extra_mins}>
              <Input name="extra_mins" inputMode="numeric" defaultValue={0} />
            </Field>
          </div>
        </>
      )}
    </SaveForm>
  );
}
