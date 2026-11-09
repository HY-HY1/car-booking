"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import type { CustomerFormState } from "@/app/app/[tenant]/customers/actions";
import {
  CUSTOMER_SOURCES,
  MARKETING_BASES,
  formatPhone,
  type Customer,
} from "@leadgen/core/customer-fields";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/toast";
import { useUnsavedChanges } from "./unsaved-changes";

const channels = [
  { name: "email_marketing", label: "Email" },
  { name: "sms_marketing", label: "SMS" },
  { name: "whatsapp_marketing", label: "WhatsApp" },
] as const;

export function CustomerForm({
  action,
  customer,
  submitLabel,
}: {
  action: (state: CustomerFormState, formData: FormData) => Promise<CustomerFormState>;
  customer?: Customer;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(async (prev: CustomerFormState, formData: FormData) => {
    const next = await action(prev, formData);
    if (next.saved) toast.success("Customer saved");
    return next;
  }, {});
  const { errors = {}, values } = state;
  const form = useRef<HTMLFormElement>(null);
  const markSaved = useUnsavedChanges(form);
  useEffect(() => {
    if (state.saved) markSaved();
  }, [state, markSaved]);

  // After a submit, show what was typed; otherwise the saved customer.
  const text = (field: keyof Customer) =>
    values ? (values[field] ?? "") : String(customer?.[field] ?? "");
  const checked = (field: (typeof channels)[number]["name"]) =>
    values ? values[field] === "on" : Boolean(customer?.[field]);

  return (
    <form ref={form} action={formAction} className="grid max-w-2xl gap-6" noValidate>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="sr-only">Contact details</legend>
        <Field label="Name" name="name" error={errors.name} className="sm:col-span-2">
          <Input id="name" name="name" autoComplete="off" defaultValue={text("name")} />
        </Field>
        <Field label="Email" name="email" error={errors.email}>
          <Input id="email" name="email" type="email" autoComplete="off" defaultValue={text("email")} />
        </Field>
        <Field label="Phone" name="phone" error={errors.phone}>
          <Input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="off"
            defaultValue={values ? text("phone") : customer?.phone ? formatPhone(customer.phone) : ""}
          />
        </Field>
        <Field label="Address" name="address_line" error={errors.address_line}>
          <Input id="address_line" name="address_line" autoComplete="off" defaultValue={text("address_line")} />
        </Field>
        <Field label="Postcode" name="postcode" error={errors.postcode}>
          <Input id="postcode" name="postcode" autoComplete="off" defaultValue={text("postcode")} />
        </Field>
        <Field label="How they found you" name="source" error={errors.source}>
          <Select
            id="source"
            name="source"
            defaultValue={text("source") || "manual"}
          >
            {Object.entries(CUSTOMER_SOURCES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notes" name="notes" error={errors.notes} className="sm:col-span-2">
          <Textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={text("notes")}
            placeholder="Access, parking, preferences…"
          />
        </Field>
      </fieldset>

      <fieldset className="grid gap-3 rounded-xl border p-4">
        <legend className="px-1 text-sm font-medium">Marketing</legend>
        <p className="text-sm text-muted-foreground">
          Booking confirmations and reminders are always sent. Tick a channel
          only if they&apos;ve agreed to offers and rebooking reminders there.
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {channels.map(({ name, label }) => (
            <Checkbox
              key={name}
              name={name}
              defaultChecked={checked(name)}
            >
              {label}
            </Checkbox>
          ))}
        </div>
        <Field label="How they agreed" name="marketing_basis" error={errors.marketing_basis}>
          <Select
            id="marketing_basis"
            name="marketing_basis"
            defaultValue={text("marketing_basis")}
          >
            <option value="">Not recorded</option>
            {Object.entries(MARKETING_BASES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </fieldset>

      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        {state.message && (
          <p role="alert" className="text-sm text-destructive">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}

