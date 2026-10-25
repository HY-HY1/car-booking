"use client";

import { useState, useTransition } from "react";
import { Check, RotateCcw, UserX, X } from "lucide-react";
import { allowedStatusChanges } from "@leadgen/core/booking/diary";
import { Button } from "@/components/ui/button";

const ACTIONS = {
  completed: { label: "Mark complete", icon: Check, variant: "default" },
  no_show: { label: "No-show", icon: UserX, variant: "outline" },
  cancelled: { label: "Cancel job", icon: X, variant: "destructive" },
  confirmed: { label: "Put back", icon: RotateCcw, variant: "outline" },
} as const;

// What the owner can do to a job from the diary. Only the changes the job's
// current status allows are offered; the server checks again.
export function JobActions({
  status,
  depositPaid,
  customer,
  action,
  canManage,
}: {
  status: string;
  depositPaid: boolean;
  customer: string;
  action: (next: string) => Promise<{ error?: string }>;
  // Technicians can't cancel or put back jobs; the server checks again.
  canManage: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const options = (allowedStatusChanges(status).filter((s) => s in ACTIONS) as (keyof typeof ACTIONS)[]).filter(
    (s) => canManage || (s !== "cancelled" && s !== "confirmed"),
  );
  if (options.length === 0) return null;

  function run(next: keyof typeof ACTIONS) {
    if (next === "cancelled") {
      const note = depositPaid ? " Their deposit stays paid until you refund it from the booking." : "";
      if (!confirm(`Cancel ${customer}'s job? This frees the time for other customers, and we'll email them to say it's cancelled.${note}`)) return;
    }
    if (next === "no_show" && !confirm(`Mark ${customer} as a no-show?`)) return;
    startTransition(async () => {
      const result = await action(next);
      setError(result.error);
    });
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {options.map((next) => {
          const { label, icon: Icon, variant } = ACTIONS[next];
          return (
            <Button key={next} type="button" variant={variant} disabled={pending} onClick={() => run(next)}>
              <Icon />
              {label}
            </Button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
