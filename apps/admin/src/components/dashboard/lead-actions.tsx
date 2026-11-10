"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { LOST_REASONS } from "@leadgen/core/leads/rules";
import { Button, buttonVariants } from "@/components/ui/button";
import { askToConfirmWith } from "@/components/ui/confirm-dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const reasons = Object.entries(LOST_REASONS).map(([value, label]) => ({ value, label }));

// What can be done with a lead: note it, record a call, book it or let it go.
export function LeadActions({
  open,
  lost,
  notes: initialNotes,
  contactLine,
  bookHref,
  saveNotes,
  recordContact,
  markLost,
  reopen,
}: {
  open: boolean;
  lost: boolean;
  notes: string;
  contactLine: string;
  bookHref: string | null;
  saveNotes: (notes: string) => Promise<{ error?: string }>;
  recordContact: () => Promise<{ error?: string }>;
  markLost: (reason: string) => Promise<{ error?: string }>;
  reopen: () => Promise<{ error?: string }>;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [saved, setSaved] = useState(initialNotes);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<{ error?: string }>, done: string, then?: () => void) =>
    startTransition(async () => {
      const { error } = await action();
      if (error) toast.error(error);
      else {
        toast.success(done);
        then?.();
      }
    });

  async function lose() {
    const answer = await askToConfirmWith(
      { title: "Mark this lead as lost?", confirmLabel: "Mark as lost", destructive: true },
      { choices: { legend: "Why didn't it go ahead?", options: reasons, defaultValue: "no_reply" } },
    );
    if (answer?.choice) run(() => markLost(answer.choice as string), "Marked as lost");
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        {bookHref && open && (
          <Link href={bookHref} className={buttonVariants({ size: "sm" })}>
            Turn into a booking
          </Link>
        )}
        {open && (
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => run(recordContact, "Contact recorded")}>
            Record contact
          </Button>
        )}
        {open && (
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={lose}>
            Mark as lost
          </Button>
        )}
        {lost && (
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => run(reopen, "Lead reopened")}>
            Reopen
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{contactLine}</p>
      <div className="grid gap-2">
        <Textarea rows={3} maxLength={4000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What was said, when to try again." aria-label="Notes" />
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(notes === saved && "opacity-50")}
            disabled={pending || notes === saved}
            onClick={() => run(() => saveNotes(notes), "Notes saved", () => setSaved(notes))}
          >
            Save notes
          </Button>
        </div>
      </div>
    </div>
  );
}
