"use client";

import { useState } from "react";
import type { DepositRule } from "@leadgen/core/booking/config";
import { policyLines, type CancellationPolicy } from "@leadgen/core/settings/policy";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Field, SaveForm, fieldClass, type Action } from "../form-kit";

// Settings → Payments: the deposit and what happens to it on cancellation.

function poundsInput(pence: number) {
  return pence % 100 === 0 ? String(pence / 100) : (pence / 100).toFixed(2);
}

export function DepositForm({ deposit, action, readOnly }: { deposit: DepositRule; action: Action; readOnly: boolean }) {
  const [type, setType] = useState(deposit.type);
  return (
    <SaveForm action={action} readOnly={readOnly}>
      {(errors) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="When customers book, they pay" name="deposit_type" error={errors.deposit_type}>
            <select
              name="deposit_type"
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              className={cn(fieldClass, "h-8")}
            >
              <option value="none">Nothing up front</option>
              <option value="percent">A percentage of the price</option>
              <option value="fixed">A fixed deposit</option>
              <option value="full">The full price</option>
            </select>
          </Field>
          {type === "percent" && (
            <Field label="Deposit (%)" name="deposit_percent" error={errors.deposit_percent}>
              <Input name="deposit_percent" inputMode="decimal" defaultValue={deposit.type === "percent" ? deposit.value : 25} />
            </Field>
          )}
          {type === "fixed" && (
            <Field label="Deposit (£)" name="deposit_fixed" error={errors.deposit_fixed}>
              <Input name="deposit_fixed" inputMode="decimal" defaultValue={deposit.type === "fixed" ? poundsInput(deposit.value_pence) : ""} />
            </Field>
          )}
          {type !== "fixed" && <input type="hidden" name="deposit_fixed" value="" />}
          <p className="text-xs text-muted-foreground sm:col-span-2">
            With Stripe connected, customers pay this by card to book. Without it, bookings go through and you collect it
            yourself. A fixed deposit is never more than the job&apos;s price.
          </p>
        </div>
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
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cancelled in time" name="refund_before_cutoff" error={errors.refund_before_cutoff}>
              <select
                name="refund_before_cutoff"
                value={before}
                onChange={(e) => setBefore(e.target.value as typeof before)}
                className={cn(fieldClass, "h-8")}
              >
                <option value="full">Refund the deposit in full</option>
                <option value="none">Keep it: deposits aren&apos;t refundable</option>
              </select>
            </Field>
            {before === "full" ? (
              <Field label="Cancelled late, or a no-show" name="late_fee_type" error={errors.late_fee_type}>
                <select
                  name="late_fee_type"
                  value={lateType}
                  onChange={(e) => setLateType(e.target.value as typeof lateType)}
                  className={cn(fieldClass, "h-8")}
                >
                  <option value="deposit">Keep the whole deposit</option>
                  <option value="fixed">Keep part of it</option>
                  <option value="none">Refund it anyway</option>
                </select>
              </Field>
            ) : (
              <input type="hidden" name="late_fee_type" value="deposit" />
            )}
            {before === "full" && lateType === "fixed" ? (
              <Field label="Amount you keep (£)" name="late_fee_amount" error={errors.late_fee_amount}>
                <Input name="late_fee_amount" inputMode="decimal" value={lateAmount} onChange={(e) => setLateAmount(e.target.value)} />
              </Field>
            ) : (
              <input type="hidden" name="late_fee_amount" value="" />
            )}
          </div>
          <div className="rounded-lg bg-muted p-3 text-sm">
            <p className="mb-1 text-xs font-medium text-muted-foreground uppercase">Customers see</p>
            {policyLines(preview, true).map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Refunds aren&apos;t sent automatically. When you cancel a job or mark a no-show, its booking page works out what
            this policy says to refund, and you send it with one click.
          </p>
        </>
      )}
    </SaveForm>
  );
}
