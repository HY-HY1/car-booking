"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { askToConfirm } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";

export function MergeCustomerButton({
  keepName,
  removeName,
  action,
}: {
  keepName: string;
  removeName: string;
  action: () => Promise<{ error?: string }>;
}) {
  const [pending, startTransition] = useTransition();

  async function press() {
    const ok = await askToConfirm({
      title: `Merge ${removeName} into ${keepName}?`,
      description: `Their bookings, cars, enquiries and photos move to ${keepName}, and the ${removeName} record is removed. This can't be undone. ${keepName}'s marketing choices stay as they are.`,
      confirmLabel: "Merge",
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const { error } = await action();
      if (error) toast.error(error);
      else toast.success("Customers merged");
    });
  }

  return (
    <Button type="button" variant="outline" size="sm" disabled={pending} onClick={press}>
      {pending ? "Merging…" : "Merge in"}
    </Button>
  );
}
