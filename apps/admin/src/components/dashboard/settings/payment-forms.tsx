"use client";

import { useState } from "react";
import type { DepositRule } from "@leadgen/core/booking/config";
import { policyLines, type CancellationPolicy } from "@leadgen/core/settings/policy";
import { MoneyInput } from "@/components/ui/money-input";
import { NumberInput } from "@/components/ui/number-input";
import { Radio } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { Field, SaveForm, type Action } from "../form-kit";

// Settings → Payments: the deposit and what happens to it on cancellation.

function poundsInput(pence: number) {
  return pence % 100 === 0 ? String(pence / 100) : (pence / 100).toFixed(2);
}

const DEPOSIT_TYPES = [
  ["none", "Nothing up front", "They pay on the day."],
  ["percent", "A percentage", "Of the job's price."],
  ["fixed", "A fixed amount", "Never more than the job's price."],
  ["full", "The full price", "Paid when they book."],
] as const;

export function DepositForm({
  deposit,
  stripeReady,
  action,
  readOnly,
}: {
  deposit: DepositRule;
  stripeReady: boolean;
  action: Action;
  readOnly: boolean;
}) {
  const [type, setType] = useState(deposit.type);
  return (
    <SaveForm action={action} readOnly={readOnly}>
      {(errors) => (
        <>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">When customers book, they pay</legend>
            <div className="grid gap-2 @lg:grid-cols-2">
              {DEPOSIT_TYPES.map(([value, label, detail]) => (
                <Radio
                  key={value}
                  name="deposit_type"
                  value={value}
                  checked={type === value}
                  onChange={() => setType(value)}
                  labelClassName="rounded-lg border p-3 has-checked:border-primary has-checked:bg-primary/5"
                >
                  <span className="font-medium">{label}</span>
                  <span className="block text-muted-foreground">{detail}</span>
                </Radio>
              ))}
            </div>
            {errors.deposit_type && (
              <p role="alert" className="text-sm text-destructive">
                {errors.deposit_type}
              </p>
            )}
          </fieldset>
          {type === "percent" && (
            <Field label="Deposit" name="deposit_percent" error={errors.deposit_percent} className="max-w-40">
              <NumberInput
                name="deposit_percent"
                unit="%"
                inputMode="decimal"
                min={1}
                max={100}
                step="any"
                defaultValue={deposit.type === "percent" ? deposit.value : 25}
              />
            </Field>
          )}
          {type === "fixed" && (
            <Field label="Deposit" name="deposit_fixed" error={errors.deposit_fixed} className="max-w-40">
              <MoneyInput name="deposit_fixed" defaultValue={deposit.type === "fixed" ? poundsInput(deposit.value_pence) : ""} />
            </Field>
          )}
          {type !== "fixed" && <input type="hidden" name="deposit_fixed" value="" />}
          {type !== "none" && (
            <p className="text-muted-foreground">
              {stripeReady
                ? "Customers pay this by card to book."
                : "Stripe isn't connected, so bookings go through without paying and you collect it yourself."}
            </p>
          )}
        </>
      )}
    </SaveForm>
  );
}

export function RefundForm({ policy, action, readOnly }: { policy: CancellationPolicy; action: Action; readOnly: boolean }) {
  const [before, setBefore] = useState(policy.refund_before_cutoff);
  const [lateType, setLateType] = useState(policy.late_fee.type);
  const [lateAmount, setLateAmount] = useState(policy.late_fee.type === "fixed" ? poundsInput(policy.late_fee.value_pence) : "");
  const amountPence = Math.round(Number(lateAmount) * 100) || 0;
  const preview: CancellationPolicy = {
    ...policy,
    refund_before_cutoff: before,
    late_fee: lateType === "fixed" ? { type: "fixed", value_pence: amountPence } : { type: lateType },
  };

  return (
    <SaveForm action={action} readOnly={readOnly}>
      {(errors) => (
        <>
          <div className="grid gap-4 @lg:grid-cols-2">
            <Field label="Cancelled in time" name="refund_before_cutoff" error={errors.refund_before_cutoff}>
              <Select name="refund_before_cutoff" value={before} onChange={(e) => setBefore(e.target.value as typeof before)}>
                <option value="full">Refund the deposit in full</option>
                <option value="none">Keep it: deposits aren&apos;t refundable</option>
              </Select>
            </Field>
            {before === "full" ? (
              <Field label="Cancelled late, or a no-show" name="late_fee_type" error={errors.late_fee_type}>
                <Select name="late_fee_type" value={lateType} onChange={(e) => setLateType(e.target.value as typeof lateType)}>
                  <option value="deposit">Keep the whole deposit</option>
                  <option value="fixed">Keep part of it</option>
                  <option value="none">Refund it anyway</option>
                </Select>
              </Field>
            ) : (
              <input type="hidden" name="late_fee_type" value="deposit" />
            )}
            {before === "full" && lateType === "fixed" ? (
              <Field label="Amount you keep" name="late_fee_amount" error={errors.late_fee_amount} className="max-w-40">
                <MoneyInput name="late_fee_amount" value={lateAmount} onChange={(e) => setLateAmount(e.target.value)} />
              </Field>
            ) : (
              <input type="hidden" name="late_fee_amount" value="" />
            )}
          </div>
          <div className="rounded-lg bg-muted p-4">
            <p className="mb-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Customers see</p>
            {policyLines(preview, true).map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <p className="text-muted-foreground">
            When you cancel a job or mark a no-show, its booking page works out what this says to refund, and you send it with
            one click.
          </p>
        </>
      )}
    </SaveForm>
  );
}
