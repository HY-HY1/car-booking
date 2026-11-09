"use client";

import { useTransition } from "react";
import { Check, X } from "lucide-react";
import { approveBookingAction, declineBookingAction } from "@/app/app/[tenant]/bookings/[id]/actions";
import { Button } from "@/components/ui/button";
import { askToConfirmWith } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";

// Approve or decline a booking that's waiting for approval. Declining asks
// for a reason (kept for the owner's records) and refunds any deposit.
export function ApprovalActions({
  slug,
  bookingId,
  customer,
  depositPaid,
}: {
  slug: string;
  bookingId: string;
  customer: string;
  depositPaid: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const approve = () =>
    startTransition(async () => {
      const { message } = await approveBookingAction(slug, bookingId);
      if (message) toast.error(message);
      else toast.success("Booking approved");
    });

  async function decline() {
    const answer = await askToConfirmWith(
      {
        title: `Decline ${customer}'s booking?`,
        description: `The time is freed for other customers${depositPaid ? " and their deposit is refunded in full" : ""}. Let them know why.`,
        confirmLabel: "Decline booking",
        cancelLabel: "Back",
        destructive: true,
      },
      { text: { label: "Reason (for your records)", placeholder: "Fully booked that day, outside my area…", maxLength: 500 } },
    );
    if (!answer) return;
    startTransition(async () => {
      const result = await declineBookingAction(slug, bookingId, answer.text);
      if (result.message) toast.error(result.message);
      else if (result.warning) toast.error(result.warning);
      else toast.success("Booking declined");
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="lg" disabled={pending} onClick={approve} className="flex-1 sm:flex-none">
        <Check /> {pending ? "Saving…" : "Approve booking"}
      </Button>
      <Button type="button" size="lg" variant="outline" disabled={pending} onClick={decline} className="flex-1 sm:flex-none">
        <X /> Decline
      </Button>
    </div>
  );
}
