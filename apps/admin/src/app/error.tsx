"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { StatusPage } from "@/components/ui/status-page";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <StatusPage
        brand
        title="Something went wrong"
        actions={
          <Button size="lg" onClick={() => retry()}>
            Try again
          </Button>
        }
      >
        That didn&apos;t load properly. Try again, and if it keeps happening, come back in a few minutes.
      </StatusPage>
    </div>
  );
}
