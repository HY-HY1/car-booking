"use client";

import { cloneElement, useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CustomerFormState } from "@/app/app/[tenant]/customers/actions";
import {
  CUSTOMER_SOURCES,
  MARKETING_BASES,
  formatPhone,
  type Customer,
} from "@leadgen/core/customer-fields";
import { cn } from "@/lib/utils";

const fieldClass =
  "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30";

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
  const [state, formAction, pending] = useActionState(action, {});
  const { errors = {}, values } = state;

  // After a submit, show what was typed; otherwise the saved customer.
  const text = (field: keyof Customer) =>
    values ? (values[field] ?? "") : String(customer?.[field] ?? "");
  const checked = (field: (typeof channels)[number]["name"]) =>
    values ? values[field] === "on" : Boolean(customer?.[field]);

  return (
    <form action={formAction} className="grid max-w-2xl gap-6" noValidate>
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
          <select
            id="source"
            name="source"
            defaultValue={text("source") || "manual"}
            className={cn(fieldClass, "h-8")}
          >
            {Object.entries(CUSTOMER_SOURCES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Notes" name="notes" error={errors.notes} className="sm:col-span-2">
          <textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={text("notes")}
            placeholder="Access, parking, preferences…"
            className={cn(fieldClass, "py-2")}
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
            <label key={name} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name={name}
                defaultChecked={checked(name)}
                className="size-4 accent-primary"
              />
              {label}
            </label>
          ))}
        </div>
        <Field label="How they agreed" name="marketing_basis" error={errors.marketing_basis}>
          <select
            id="marketing_basis"
            name="marketing_basis"
            defaultValue={text("marketing_basis")}
            className={cn(fieldClass, "h-8")}
          >
            <option value="">Not recorded</option>
            {Object.entries(MARKETING_BASES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </fieldset>

      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <p role="status" className="text-sm">
          {state.message ? (
            <span className="text-destructive">{state.message}</span>
          ) : state.saved && !pending ? (
            <span className="text-muted-foreground">Saved.</span>
          ) : null}
        </p>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  error,
  className,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  className?: string;
  children: React.ReactElement<{
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
  }>;
}) {
  return (
    <div className={cn("grid content-start gap-2", className)}>
      <Label htmlFor={name}>{label}</Label>
      {cloneElement(children, {
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error ? `${name}-error` : undefined,
      })}
      {error && (
        <p id={`${name}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
