"use client";

import { useState, useTransition } from "react";
import { Link2, Mail } from "lucide-react";
import { formatPence } from "@leadgen/core/booking/config";
import { createBalanceLinkAction, type BalanceLinkState } from "@/app/app/[tenant]/bookings/[id]/actions";
import { CopyText } from "@/components/platform/copy-text";
import { Button } from "@/components/ui/button";

// Payment actions on a booking, shown while something is still owed.
export function BookingPaymentActions({
  slug,
  bookingId,
  balancePence,
  blockedReason,
}: {
  slug: string;
  bookingId: string;
  balancePence: number;
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
              setState(await createBalanceLinkAction(slug, bookingId));
            })
          }
        >
          <Link2 />
          {pending ? "Creating…" : `Create payment link · ${formatPence(balancePence)}`}
        </Button>
        {/* Emailing isn't built yet: the button is here so the place is clear. */}
        <Button type="button" variant="outline" disabled title="Coming soon: sending email isn't set up yet">
          <Mail />
          Email payment link
        </Button>
      </div>
      {blockedReason && <p className="text-xs text-muted-foreground">{blockedReason}</p>}
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.link && (
        <div className="grid gap-2 rounded-lg border p-3 text-sm">
          <p className="font-medium">
            {state.link.description}: {formatPence(state.link.amountPence)}
          </p>
          <CopyText value={state.link.url} label="payment link" />
          <p className="text-xs text-muted-foreground">
            Send it to the customer. It stops working after one payment. Emailing it from here is coming soon.
          </p>
        </div>
      )}
    </div>
  );
}
