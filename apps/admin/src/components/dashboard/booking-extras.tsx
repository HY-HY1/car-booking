"use client";

import { useState, useTransition } from "react";
import { formatPence } from "@leadgen/core/booking/config";
import { Button } from "@/components/ui/button";
import { askToConfirm, askToConfirmWith } from "@/components/ui/confirm-dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";

// The smaller things done from a booking's page.

export function InternalNotes({ initial, save }: { initial: string; save: (text: string) => Promise<{ error?: string }> }) {
  const [text, setText] = useState(initial);
  const [savedText, setSavedText] = useState(initial);
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-2">
      <Textarea
        rows={4}
        maxLength={4000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Gate code, what was agreed on the phone, anything the team should know."
        aria-label="Team notes"
      />
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending || text === savedText}
          onClick={() =>
            startTransition(async () => {
              const { error } = await save(text);
              if (error) toast.error(error);
              else {
                setSavedText(text);
                toast.success("Notes saved");
              }
            })
          }
        >
          {pending ? "Saving…" : "Save notes"}
        </Button>
      </div>
    </div>
  );
}

// A card payment other than the deposit, back in full or in part.
export function RefundPayment({
  remainingPence,
  action,
}: {
  remainingPence: number;
  action: (amountPence: number) => Promise<{ message?: string }>;
}) {
  const [pending, startTransition] = useTransition();

  async function press() {
    const answer = await askToConfirmWith(
      {
        title: "Refund this payment?",
        description: `Up to ${formatPence(remainingPence)}. A refund can't be undone, and Stripe doesn't return its processing fee.`,
        confirmLabel: "Refund",
        destructive: true,
      },
      { text: { label: "Amount in pounds (blank for all of it)", maxLength: 12 } },
    );
    if (!answer) return;
    const typed = answer.text.trim().replace(/^£/, "");
    const pence = typed === "" ? remainingPence : Math.round(Number(typed) * 100);
    if (!Number.isInteger(pence) || pence <= 0 || pence > remainingPence) {
      toast.error(`Enter an amount up to ${formatPence(remainingPence)}.`);
      return;
    }
    startTransition(async () => {
      const { message } = await action(pence);
      if (message) toast.error(message);
      else toast.success(`${formatPence(pence)} refunded`);
    });
  }

  return (
    <button type="button" onClick={press} disabled={pending} className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
      {pending ? "Refunding…" : "Refund"}
    </button>
  );
}

export function CancelRepeats({ count, action }: { count: number; action: (reason: string) => Promise<{ message?: string; cancelled?: number }> }) {
  const [pending, startTransition] = useTransition();

  async function press() {
    const answer = await askToConfirmWith(
      {
        title: `Cancel ${count === 1 ? "this visit" : `all ${count} visits still to come`}?`,
        description: "Their times open up again. The customer isn't emailed about each one, so let them know yourself.",
        confirmLabel: "Cancel them",
        cancelLabel: "Keep them",
        destructive: true,
      },
      { text: { label: "Reason (optional, just for your records)", maxLength: 500 } },
    );
    if (!answer) return;
    startTransition(async () => {
      const { message, cancelled } = await action(answer.text);
      if (message) toast.error(message);
      else toast.success(`${cancelled} ${cancelled === 1 ? "visit" : "visits"} cancelled`);
    });
  }

  return (
    <Button type="button" variant="outline" size="sm" disabled={pending} onClick={press}>
      {pending ? "Cancelling…" : "Cancel repeats still to come"}
    </Button>
  );
}

export function RemoveExtraCar({ label, action }: { label: string; action: () => Promise<{ error?: string }> }) {
  const [pending, startTransition] = useTransition();

  async function press() {
    if (!(await askToConfirm({ title: `Remove ${label}?`, description: "Its price and time come off this booking.", confirmLabel: "Remove", destructive: true }))) return;
    startTransition(async () => {
      const { error } = await action();
      if (error) toast.error(error);
      else toast.success("Car removed");
    });
  }

  return (
    <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={press}>
      Remove
    </Button>
  );
}
