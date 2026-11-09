"use client";

import { useActionState } from "react";
import type { BlockTimeState } from "@/app/app/[tenant]/diary/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/toast";

// "Block out time": a holiday, a day off, the van in for a service. Customers
// can't book into it (for the whole business, or one van or bay). The all-day
// tickbox hides the times with CSS, so it needs no state of its own.

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
  const [state, formAction, pending] = useActionState(async (prev: BlockTimeState, formData: FormData) => {
    const next = await action(prev, formData);
    if (next.saved && !next.message) toast.success("Time blocked out");
    return next;
  }, {});
  const { errors = {}, values } = state;
  const text = (field: string, fallback: string) => (values ? (values[field] ?? "") : fallback);

  return (
    <form action={formAction} className="group grid max-w-2xl gap-4 sm:grid-cols-2" noValidate>
      {resources.length > 1 && (
        <Field label="Who is off" name="resource_id" error={errors.resource_id} className="sm:col-span-2">
          <Select
            id="resource_id"
            name="resource_id"
            defaultValue={text("resource_id", "")}
          >
            <option value="">The whole business</option>
            {resources.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} only
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="From" name="start_date" error={errors.start_date}>
        <Input id="start_date" name="start_date" type="date" defaultValue={text("start_date", defaultDate)} />
      </Field>
      <Field label="Until (optional)" name="end_date" error={errors.end_date}>
        <Input id="end_date" name="end_date" type="date" defaultValue={text("end_date", "")} />
      </Field>

      <Checkbox
        labelClassName="sm:col-span-2"
        name="all_day"
        defaultChecked={values ? values.all_day === "on" : true}
      >
        All day
      </Checkbox>

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
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : "Block this time"}
        </Button>
        <p role="status" className="text-sm">
          {state.message ? (
            <span className={state.saved ? "text-amber-700 dark:text-amber-400" : "text-destructive"}>{state.message}</span>
          ) : null}
        </p>
      </div>
    </form>
  );
}

