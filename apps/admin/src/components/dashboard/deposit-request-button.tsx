"use client";

import { useTransition } from "react";
import { Mail } from "lucide-react";
import { formatPence } from "@leadgen/core/booking/config";
import { emailDepositRequestAction } from "@/app/app/[tenant]/bookings/[id]/actions";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

// "Email deposit request", on a booking whose deposit is still owed: the
// customer gets an email with a button to pay it from their booking page.
// Each press sends it again.
export function DepositRequestButton({
  slug,
  bookingId,
  depositPence,
  customerEmail,
  blockedReason,
}: {
  slug: string;
  bookingId: string;
  depositPence: number;
  customerEmail: string | null;
  // Why it can't be sent right now (e.g. Stripe not connected).
  blockedReason?: string;
}) {
  const [pending, start] = useTransition();
  const reason = blockedReason ?? (customerEmail ? undefined : "Add the customer's email address to send them a deposit request.");

  return (
    <div className="grid gap-1.5">
      <Button
        type="button"
        variant="outline"
        disabled={pending || !!reason}
        onClick={() =>
          start(async () => {
            const { error } = await emailDepositRequestAction(slug, bookingId);
            if (error) toast.error(error);
            else toast.success(`Deposit request sent to ${customerEmail}`);
          })
        }
        className="w-fit"
      >
        <Mail />
        {pending ? "Sending…" : `Email ${formatPence(depositPence)} deposit request`}
      </Button>
      {reason && <p className="text-xs text-muted-foreground">{reason}</p>}
    </div>
  );
}
