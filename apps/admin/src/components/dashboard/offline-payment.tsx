"use client";

import { useActionState, useState, useTransition } from "react";
import { Banknote, Trash2 } from "lucide-react";
import type { OfflineMethod } from "@leadgen/core/stripe/payment-rules";
import {
  recordPaymentAction,
  removePaymentAction,
  type OfflinePaymentState,
} from "@/app/app/[tenant]/bookings/[id]/actions";
import { Field } from "@/components/dashboard/form-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { cn } from "@/lib/utils";
import { Radio } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/toast";
import { askToConfirm } from "@/components/ui/confirm-dialog";

const METHODS: { value: OfflineMethod; label: string; placeholder: string }[] = [
  { value: "cash", label: "Cash", placeholder: "Balance on the day" },
  { value: "bank_transfer", label: "Bank transfer", placeholder: "Reference or date it arrived" },
];

// "Record payment" on a booking: money taken outside Stripe, in cash or by
// bank transfer. The amount starts at what's still to pay. Counts towards
// what's paid as soon as it's saved.
export function RecordPayment({ slug, bookingId, balancePence }: { slug: string; bookingId: string; balancePence: number }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prev: OfflinePaymentState, formData: FormData) => {
      const next = await recordPaymentAction(slug, bookingId, prev, formData);
      if (next.saved) {
        setOpen(false);
        toast.success("Payment recorded");
      }
      return next;
    },
    {},
  );
  const balance = balancePence > 0 ? (balancePence / 100).toFixed(2) : "";
  const [method, setMethod] = useState<OfflineMethod>("cash");
  const [amount, setAmount] = useState(balance);
  const [note, setNote] = useState("");

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        className="w-fit"
        onClick={() => {
          setMethod("cash");
          setAmount(balance);
          setNote("");
          setOpen(true);
        }}
      >
        <Banknote />
        Record cash or bank transfer
      </Button>
    );
  }

  return (
    <form action={formAction} className="grid gap-3" noValidate>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">How they paid</legend>
        <div className="flex flex-wrap gap-2">
          {METHODS.map((m) => (
            <Radio
              key={m.value}
              labelClassName={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors",
                method === m.value ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted",
              )}
              name="method"
              value={m.value}
              checked={method === m.value}
              onChange={() => setMethod(m.value)}
              className="mt-0"
            >
              {m.label}
            </Radio>
          ))}
        </div>
        {state.errors?.method && <p className="text-sm text-destructive">{state.errors.method}</p>}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
        <Field label="Amount" name="amount" error={state.errors?.amount}>
          <MoneyInput name="amount" inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Note (optional)" name="note" error={state.errors?.note}>
          <Input
            name="note"
            maxLength={200}
            placeholder={METHODS.find((m) => m.value === method)?.placeholder}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : "Save payment"}
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {state.message && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
    </form>
  );
}

// Takes a cash payment or bank transfer back off, for one added by mistake.
export function RemovePayment({ slug, bookingId, paymentId }: { slug: string; bookingId: string; paymentId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label="Remove this payment"
      title="Remove this payment"
      onClick={async () => {
        const confirmed = await askToConfirm({
          title: "Remove this payment?",
          description: "Only do this if it was recorded by mistake.",
          confirmLabel: "Remove payment",
          destructive: true,
        });
        if (!confirmed) return;
        start(async () => {
          const { message } = await removePaymentAction(slug, bookingId, paymentId);
          if (message) toast.error(message);
          else toast.success("Payment removed");
        });
      }}
      className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-50"
    >
      <Trash2 className="size-3.5" />
    </button>
  );
}
