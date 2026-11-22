"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { askToConfirmWith } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";

// Deletes a business for good. The dashboard ID has to be typed back.
export function DeleteBusiness({ name, slug, action }: { name: string; slug: string; action: (typed: string) => Promise<{ error?: string } | void> }) {
  const [pending, startTransition] = useTransition();

  async function run() {
    const answer = await askToConfirmWith(
      {
        title: `Delete ${name} for good?`,
        description:
          "Their subscription is cancelled now, and every booking, customer, enquiry, photo and setting is deleted. Logins on no other business are deleted too. This can't be undone; export their data from their dashboard first if it may be needed.",
        confirmLabel: "Delete everything",
        destructive: true,
      },
      { text: { label: `Type ${slug} to confirm`, placeholder: slug, maxLength: 60 } },
    );
    if (!answer) return;
    if (answer.text.trim() !== slug) {
      toast.error(`That didn't match ${slug}. Nothing was deleted.`);
      return;
    }
    startTransition(async () => {
      const result = await action(answer.text);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <Button type="button" variant="destructive" disabled={pending} onClick={run}>
      {pending ? "Deleting…" : "Delete business"}
    </Button>
  );
}
