"use client";

import { useState, useTransition } from "react";
import { Link2, Mail } from "lucide-react";
import { formatPence } from "@leadgen/core/booking/config";
import { createBalanceLinkAction, emailBalanceLinkAction, type BalanceLinkState } from "@/app/app/[tenant]/bookings/[id]/actions";
import { CopyText } from "@/components/platform/copy-text";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { askToConfirm } from "@/components/ui/confirm-dialog";

// Payment actions on a booking, shown while something is still owed.
export function BookingPaymentActions({
  slug,
  bookingId,
  balancePence,
  customerEmail,
  blockedReason,
}: {
  slug: string;
  bookingId: string;
  balancePence: number;
  customerEmail: string | null;
  // Why creating a link isn't possible right now (e.g. Stripe not connected).
  blockedReason?: string;
}) {
  const [state, setState] = useState<BalanceLinkState>({});
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={pending || Boolean(blockedReason)}
          onClick={() =>
            startTransition(async () => {
              const result = await createBalanceLinkAction(slug, bookingId);
              setState(result);
              if (result.error) toast.error(result.error);
              else toast.success("Payment link created");
            })
          }
        >
          <Link2 />
          {pending ? "Creating…" : `Create payment link · ${formatPence(balancePence)}`}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending || Boolean(blockedReason) || !customerEmail}
          title={customerEmail ? undefined : "This customer has no email address"}
          onClick={async () => {
            const confirmed = await askToConfirm({
              title: "Email a payment link?",
              description: `We'll send a link for ${formatPence(balancePence)} to ${customerEmail}.`,
              confirmLabel: "Send email",
            });
            if (!confirmed) return;
            startTransition(async () => {
              const result = await emailBalanceLinkAction(slug, bookingId);
              setState(result);
              if (result.error) toast.error(result.error);
              else if (result.sentTo) toast.success(`Payment link emailed to ${result.sentTo}`);
            });
          }}
        >
          <Mail />
          {pending ? "Working…" : "Email payment link"}
        </Button>
      </div>
      {blockedReason && <p className="text-xs text-muted-foreground">{blockedReason}</p>}
      {state.link && (
        <div className="grid gap-2 rounded-lg border p-3 text-sm">
          <p className="font-medium">
            {state.link.description}: {formatPence(state.link.amountPence)}
          </p>
          <CopyText value={state.link.url} label="payment link" />
          <p className="text-xs text-muted-foreground">
            {state.sentTo ? "It stops working after one payment." : "Send it to the customer. It stops working after one payment."}
          </p>
        </div>
      )}
    </div>
  );
}
