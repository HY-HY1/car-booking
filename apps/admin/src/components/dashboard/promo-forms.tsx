"use client";

import { useTransition } from "react";
import { Field, SaveForm, type Action } from "@/components/dashboard/form-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";

export function PromoForm({ action }: { action: Action }) {
  return (
    <SaveForm action={action} submitLabel="Add code" savedText="Code added. Customers can use it now." resetOnSave>
      {(errors) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code" name="code" error={errors.code}>
            <Input name="code" className="font-mono uppercase" autoComplete="off" placeholder="SPRING10" />
          </Field>
          <Field label="Kind" name="kind" error={errors.kind}>
            <Select name="kind" defaultValue="percent">
              <option value="percent">Percentage off</option>
              <option value="fixed">Amount off (£)</option>
            </Select>
          </Field>
          <Field label="How much" name="amount" error={errors.amount}>
            <Input name="amount" inputMode="decimal" />
          </Field>
          <Field label="Uses allowed (blank for no limit)" name="max_uses" error={errors.max_uses}>
            <Input name="max_uses" inputMode="numeric" />
          </Field>
          <Field label="Last day (optional)" name="expires_on" error={errors.expires_on}>
            <Input name="expires_on" type="date" />
          </Field>
        </div>
      )}
    </SaveForm>
  );
}

export function PromoToggle({ active, action }: { active: boolean; action: () => Promise<{ error?: string }> }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const { error } = await action();
          if (error) toast.error(error);
        })
      }
    >
      {active ? "Switch off" : "Switch on"}
    </Button>
  );
}
