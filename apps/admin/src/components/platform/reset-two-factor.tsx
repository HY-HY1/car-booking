"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

// For someone who has lost their authenticator app, once you've checked it's
// them. Two presses, so a stray click can't take it off.
export function ResetTwoFactor({ action, email }: { action: () => Promise<{ removed?: number; error?: string }>; email: string }) {
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();

  function press() {
    if (!armed) {
      setArmed(true);
      return;
    }
    startTransition(async () => {
      const result = await action();
      setArmed(false);
      if (result.error) toast.error(result.error);
      else toast.success(result.removed ? `Two-factor login reset for ${email}` : `${email} doesn't have two-factor login on`);
    });
  }

  return (
    <Button type="button" variant={armed ? "destructive" : "ghost"} size="sm" disabled={pending} onClick={press} onBlur={() => setArmed(false)}>
      {pending ? "Resetting…" : armed ? "Confirm reset" : "Reset two-factor"}
    </Button>
  );
}
