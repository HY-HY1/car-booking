"use client";

import { cloneElement, useActionState } from "react";
import type { BlockTimeState } from "@/app/app/[tenant]/diary/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// "Block out time": a holiday, a day off, the van in for a service. Customers
// can't book into it (for the whole business, or one van or bay). Opens from a plain <details>, so it needs no state of
// its own; the all-day tickbox hides the times with CSS.

export function BlockTimeForm({
  action,
  defaultDate,
  resources,
}: {
  action: (state: BlockTimeState, formData: FormData) => Promise<BlockTimeState>;
  defaultDate: string;
  // Offered when there is more than one: block everything, or just one.
  resources: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const { errors = {}, values } = state;
  const text = (field: string, fallback: string) => (values ? (values[field] ?? "") : fallback);

  return (
    <form action={formAction} className="group grid max-w-2xl gap-4 sm:grid-cols-2" noValidate>
      {resources.length > 1 && (
        <Field label="Who is off" name="resource_id" error={errors.resource_id} className="sm:col-span-2">
          <select
            id="resource_id"
            name="resource_id"
            defaultValue={text("resource_id", "")}
            className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
          >
            <option value="">The whole business</option>
            {resources.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} only
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="From" name="start_date" error={errors.start_date}>
        <Input id="start_date" name="start_date" type="date" defaultValue={text("start_date", defaultDate)} />
      </Field>
      <Field label="Until (optional)" name="end_date" error={errors.end_date}>
        <Input id="end_date" name="end_date" type="date" defaultValue={text("end_date", "")} />
      </Field>

      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          name="all_day"
          defaultChecked={values ? values.all_day === "on" : true}
          className="size-4 accent-primary"
        />
        All day
      </label>

      <div className="hidden gap-4 group-has-[input[name=all_day]:not(:checked)]:grid sm:col-span-2 sm:grid-cols-2">
        <Field label="Start time" name="start_time" error={errors.start_time}>
          <Input id="start_time" name="start_time" type="time" defaultValue={text("start_time", "09:00")} />
        </Field>
        <Field label="End time" name="end_time" error={errors.end_time}>
          <Input id="end_time" name="end_time" type="time" defaultValue={text("end_time", "17:00")} />
        </Field>
      </div>

      <Field label="Reason (optional)" name="reason" error={errors.reason} className="sm:col-span-2">
        <Input
          id="reason"
          name="reason"
          autoComplete="off"
          placeholder="Holiday, van in for service…"
          defaultValue={text("reason", "")}
        />
      </Field>

      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Block this time"}
        </Button>
        <p role="status" className="text-sm">
          {state.message ? (
            <span className={state.saved ? "text-amber-700 dark:text-amber-400" : "text-destructive"}>{state.message}</span>
          ) : state.saved && !pending ? (
            <span className="text-muted-foreground">Blocked.</span>
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
  children: React.ReactElement<{ "aria-invalid"?: boolean; "aria-describedby"?: string }>;
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
