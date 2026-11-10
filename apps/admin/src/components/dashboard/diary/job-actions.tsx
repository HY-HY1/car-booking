"use client";

import { useTransition } from "react";
import { Check, CircleCheck, RotateCcw, UserX, X } from "lucide-react";
import { formatPence } from "@leadgen/core/booking/config";
import { allowedStatusChanges } from "@leadgen/core/booking/diary";
import type { RefundAdvice } from "@leadgen/core/settings/policy";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { askToConfirm, askToConfirmWith, type Choices } from "@/components/ui/confirm-dialog";

const ACTIONS = {
  completed: { label: "Mark complete", icon: Check, variant: "default" },
  no_show: { label: "No-show", icon: UserX, variant: "outline" },
  cancelled: { label: "Cancel job", icon: X, variant: "destructive" },
  confirmed: { label: "Put back", icon: RotateCcw, variant: "outline" },
} as const;

const DONE = {
  completed: "Job marked complete",
  no_show: "Marked as a no-show",
  cancelled: "Job cancelled",
  confirmed: "Job put back",
} as const;

// A hold is confirmed rather than put back.
const CONFIRM_HOLD = { label: "Confirm booking", icon: CircleCheck, variant: "default" } as const;

// A deposit that can go back when the job is cancelled.
export type RefundOffer = { depositPence: number; advice: RefundAdvice | null };

// The policy's answer is picked to start with. With no policy nothing is: a
// refund can't be undone, so it has to be asked for.
function refundChoices({ depositPence, advice }: RefundOffer): Choices {
  const full = formatPence(depositPence);
  const partial = advice?.kind === "partial" ? advice.refundPence : null;
  const note = "A refund can't be undone, and Stripe doesn't return its processing fee.";
  return {
    legend: `Their ${full} deposit`,
    hint: advice?.reason,
    defaultValue: String(partial ?? (advice?.kind === "full" ? depositPence : 0)),
    options: [
      ...(partial !== null
        ? [{ value: String(partial), label: `Refund ${formatPence(partial)} (your policy)`, confirmLabel: `Cancel and refund ${formatPence(partial)}`, note }]
        : []),
      {
        value: String(depositPence),
        label: `Refund the full ${full}${advice?.kind === "full" ? " (your policy)" : ""}`,
        confirmLabel: `Cancel and refund ${full}`,
        note,
      },
      {
        value: "0",
        label: `Keep the deposit${advice?.kind === "none" ? " (your policy)" : ""}`,
        confirmLabel: "Cancel job",
        note: "You can still refund it later from the booking.",
      },
    ],
  };
}

// What the owner can do to a job from the diary or its page. Only the changes
// the job's current status allows are offered; the server checks again.
export function JobActions({
  status,
  depositPaid,
  customer,
  action,
  canManage,
  refund,
}: {
  status: string;
  depositPaid: boolean;
  customer: string;
  action: (next: string, refundPence?: number, reason?: string) => Promise<{ error?: string; warning?: string }>;
  // Technicians can't cancel or put back jobs; the server checks again.
  canManage: boolean;
  // Set when this person can give the deposit back while cancelling.
  refund?: RefundOffer;
}) {
  const [pending, startTransition] = useTransition();
  const options = (allowedStatusChanges(status).filter((s) => s in ACTIONS) as (keyof typeof ACTIONS)[]).filter(
    (s) => canManage || (s !== "cancelled" && s !== "confirmed"),
  );
  if (options.length === 0) return null;

  const confirmingHold = (next: keyof typeof ACTIONS) => next === "confirmed" && status === "held";

  async function goAhead(next: keyof typeof ACTIONS) {
    if (next === "no_show") {
      return askToConfirm({ title: `Mark ${customer} as a no-show?`, confirmLabel: "Mark as no-show" });
    }
    if (confirmingHold(next)) {
      return askToConfirm({
        title: `Confirm ${customer}'s booking without waiting for the deposit?`,
        description: "We'll email them their confirmation, and the deposit stays owed until you ask for it or they pay.",
        confirmLabel: "Confirm booking",
      });
    }
    return true;
  }

  async function run(next: keyof typeof ACTIONS) {
    let refundPence = 0;
    let reason = "";
    if (next === "cancelled") {
      const note = !refund && depositPaid ? " Their deposit stays paid until you refund it from the booking." : "";
      const answer = await askToConfirmWith(
        {
          title: `Cancel ${customer}'s job?`,
          description: `This frees the time for other customers, and we'll email them to say it's cancelled.${note}`,
          confirmLabel: refund ? undefined : "Cancel job",
          cancelLabel: "Keep job",
          destructive: true,
        },
        { ...(refund && { choices: refundChoices(refund) }), text: { label: "Reason (optional, just for your records)", maxLength: 500 } },
      );
      if (!answer) return;
      reason = answer.text;
      if (refund) refundPence = Number(answer.choice);
    } else if (!(await goAhead(next))) {
      return;
    }
    startTransition(async () => {
      const { error, warning } = await action(next, refundPence, reason);
      if (error) toast.error(error);
      else if (warning) toast.error(warning);
      else if (refundPence) toast.success(`Job cancelled and ${formatPence(refundPence)} refunded`);
      else toast.success(confirmingHold(next) ? "Booking confirmed" : DONE[next]);
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((next) => {
        const { label, icon: Icon, variant } = confirmingHold(next) ? CONFIRM_HOLD : ACTIONS[next];
        return (
          <Button
            key={next}
            type="button"
            size="lg"
            variant={variant}
            disabled={pending}
            onClick={() => run(next)}
            className="flex-1 max-sm:[&_svg]:hidden sm:flex-none"
          >
            <Icon />
            {label}
          </Button>
        );
      })}
    </div>
  );
}
