"use client";

import { useState, useTransition } from "react";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import type { MoveJob } from "./diary-grid";

// Moving a job without dragging it: for a phone, and for anyone not using a mouse.
export function MoveJobForm({
  bookingId,
  date,
  time,
  resourceId,
  resources,
  canEmail,
  customer,
  move,
}: {
  bookingId: string;
  date: string;
  time: string;
  resourceId: string;
  resources: { id: string; name: string }[];
  canEmail: boolean;
  customer: string;
  move: MoveJob;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button type="button" variant="outline" size="lg" className="w-full" onClick={() => setOpen(true)}>
        <CalendarClock />
        Change date or time
      </Button>
    );
  }

  function submit(form: FormData) {
    startTransition(async () => {
      try {
        const result = await move(bookingId, {
          date: String(form.get("date")),
          time: String(form.get("time")),
          resourceId: String(form.get("resource_id") ?? resourceId),
          notify: form.get("notify") === "on",
        });
        setError(result.error);
        if (result.error) return;
        toast.success("Job moved");
        setOpen(false);
      } catch {
        setError("Couldn't reach the server. Check your connection and try again.");
      }
    });
  }

  return (
    <form action={submit} className="grid grid-cols-2 gap-3 rounded-xl border p-3" noValidate>
      <Field label="Date" name="move_date">
        <Input id="move_date" name="date" type="date" defaultValue={date} required />
      </Field>
      <Field label="Start time" name="move_time">
        <Input id="move_time" name="time" type="time" defaultValue={time} required />
      </Field>
      {resources.length > 1 && (
        <Field label="Assigned to" name="move_resource" className="col-span-2">
          <Select id="move_resource" name="resource_id" defaultValue={resourceId}>
            {resources.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {canEmail && (
        <Checkbox name="notify" defaultChecked labelClassName="col-span-2">
          Email {customer} the new time
        </Checkbox>
      )}
      {error && (
        <p role="alert" className="col-span-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="col-span-2 flex gap-2">
        <Button type="submit" size="lg" disabled={pending} className="flex-1">
          {pending ? "Moving…" : "Move job"}
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={() => setOpen(false)}>
          Keep as it is
        </Button>
      </div>
    </form>
  );
}
