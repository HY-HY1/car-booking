"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { StatusPage } from "@/components/ui/status-page";

// Inside the dashboard, so the menu stays and they can go elsewhere.
export default function DashboardError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusPage
      title="This page didn't load"
      actions={
        <Button size="lg" onClick={() => retry()}>
          Try again
        </Button>
      }
    >
      Nothing has been lost. Try again, or pick another page from the menu.
    </StatusPage>
  );
}
