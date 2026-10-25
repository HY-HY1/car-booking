"use client";

import { useState, useTransition } from "react";
import { formatPence } from "@leadgen/core/booking/config";
import type { RefundAdvice } from "@leadgen/core/settings/policy";
import { Button } from "@/components/ui/button";
import { refundDepositAction } from "@/app/app/[tenant]/bookings/[id]/actions";

// Two steps so a deposit can't be refunded by a stray click. When the
// business has a cancellation policy and the job is cancelled, the policy's
// amount is offered first; a full refund is always available.
export function RefundDeposit({
  slug,
  bookingId,
  depositPence,
  advice,
}: {
  slug: string;
  bookingId: string;
  depositPence: number;
  advice?: RefundAdvice | null;
}) {
  const [amount, setAmount] = useState<number | null>(null);
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  const full = formatPence(depositPence);
  const partial = advice?.kind === "partial" ? advice.refundPence : null;

  if (amount === null) {
    return (
      <div className="grid gap-2">
        {advice && <p className="text-sm text-muted-foreground">{advice.reason}</p>}
        <div className="flex flex-wrap gap-2">
          {partial !== null && (
            <Button type="button" variant="outline" onClick={() => setAmount(partial)}>
              Refund {formatPence(partial)} (your policy)
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => setAmount(depositPence)}>
            Refund {partial !== null || advice?.kind === "none" ? `the full ${full}` : "deposit"}
          </Button>
        </div>
      </div>
    );
  }

  const shown = formatPence(amount);
  return (
    <div className="grid max-w-md gap-3 rounded-lg border p-4">
      <p>
        Refund {shown} {amount < depositPence ? `of the ${full} deposit` : "deposit"} to the customer? Stripe doesn&apos;t
        return its own processing fee on refunds, so this costs you slightly more than {shown}. A refund can&apos;t be
        undone.
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="destructive"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await refundDepositAction(slug, bookingId, amount < depositPence ? amount : undefined);
              setMessage(result.message);
              if (!result.message) setAmount(null);
            })
          }
        >
          {pending ? "Refunding…" : `Refund ${shown}`}
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={() => setAmount(null)}>
          Keep deposit
        </Button>
      </div>
      {message && (
        <p role="alert" className="text-destructive">
          {message}
        </p>
      )}
    </div>
  );
}
