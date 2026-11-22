"use client";

import { useState, useTransition } from "react";
import { ROLES, ROLE_KEYS } from "@leadgen/core/team/access";
import { Button } from "@/components/ui/button";
import { askToConfirm } from "@/components/ui/confirm-dialog";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { ResetTwoFactor } from "./reset-two-factor";

type Result = { ok?: true; error?: string };

// One person on a business: their access level, changeable in place, and
// ways to take them off or reset their two-factor login.
export function MemberRow({
  email,
  role,
  isYou,
  setRole,
  remove,
  resetTwoFactor,
}: {
  email: string;
  role: string;
  isYou: boolean;
  setRole: (role: string) => Promise<Result>;
  remove: () => Promise<Result>;
  resetTwoFactor: () => Promise<{ removed?: number; error?: string }>;
}) {
  const [value, setValue] = useState(role);
  const [pending, startTransition] = useTransition();

  function change(next: string) {
    const before = value;
    setValue(next);
    startTransition(async () => {
      const result = await setRole(next);
      if (result.error) {
        setValue(before);
        toast.error(result.error);
      } else toast.success(`${email} is now ${ROLES[next as keyof typeof ROLES]?.label ?? next}`);
    });
  }

  async function takeOff() {
    const ok = await askToConfirm({
      title: `Remove ${email}?`,
      description: "They lose access to this business straight away. Their login stays, so they can still use any other business they're on.",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await remove();
      if (result.error) toast.error(result.error);
      else toast.success(`Removed ${email}`);
    });
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-2 text-sm">
      <span className="min-w-0 truncate">
        {email}
        {isYou && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}
      </span>
      <span className="flex shrink-0 flex-wrap items-center gap-2">
        <ResetTwoFactor action={resetTwoFactor} email={email} />
        <Select aria-label={`Access for ${email}`} value={value} disabled={pending} onChange={(e) => change(e.target.value)} className="h-8 w-32">
          {ROLE_KEYS.map((key) => (
            <option key={key} value={key}>
              {ROLES[key].label}
            </option>
          ))}
        </Select>
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={takeOff} className="text-destructive">
          Remove
        </Button>
      </span>
    </li>
  );
}
