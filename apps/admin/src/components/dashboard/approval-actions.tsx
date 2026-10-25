"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { approveBookingAction, declineBookingAction } from "@/app/app/[tenant]/bookings/[id]/actions";
import { Button } from "@/components/ui/button";
import { fieldClass } from "./form-kit";

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
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  const approve = () =>
    startTransition(async () => {
      setMessage((await approveBookingAction(slug, bookingId)).message);
    });
  const decline = () =>
    startTransition(async () => {
      const result = await declineBookingAction(slug, bookingId, reason);
      setMessage(result.message ?? result.warning);
      if (!result.message) setDeclining(false);
    });

  return (
    <div className="grid gap-3">
      {!declining ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={pending} onClick={approve}>
            <Check /> {pending ? "Saving…" : "Approve booking"}
          </Button>
          <Button type="button" variant="outline" disabled={pending} onClick={() => setDeclining(true)}>
            <X /> Decline
          </Button>
        </div>
      ) : (
        <div className="grid max-w-md gap-3 rounded-lg border p-4">
          <p className="text-sm">
            Decline {customer}&apos;s booking? The time is freed for other customers
            {depositPaid ? " and their deposit is refunded in full" : ""}. Let them know why.
          </p>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Reason (for your records)</span>
            <textarea
              rows={2}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={fieldClass}
              placeholder="Fully booked that day, outside my area…"
            />
          </label>
          <div className="flex gap-2">
            <Button type="button" variant="destructive" disabled={pending} onClick={decline}>
              {pending ? "Declining…" : "Decline booking"}
            </Button>
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setDeclining(false)}>
              Back
            </Button>
          </div>
        </div>
      )}
      {message && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}
    </div>
  );
}
