"use client";

import { useTransition } from "react";
import { Check, Globe } from "lucide-react";
import type { SaveState } from "@/app/app/[tenant]/pricing/actions";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

// A Google review's "Show on booking page" button on the Reviews page: puts
// it in (or takes it out of) the booking page's reviews section.
export function ReviewPin({ shown, action }: { shown: boolean; action: (show: boolean) => Promise<SaveState> }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant={shown ? "secondary" : "outline"}
      aria-pressed={shown}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await action(!shown);
          if (result.message) toast.error(result.message);
          else toast.success(shown ? "Taken off your booking page" : "Showing on your booking page");
        })
      }
    >
      {shown ? <Check aria-hidden /> : <Globe aria-hidden />}
      {shown ? "On booking page" : "Show on booking page"}
    </Button>
  );
}
