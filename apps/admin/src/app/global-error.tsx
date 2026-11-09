"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { StatusPage } from "@/components/ui/status-page";
import "./globals.css";

// Only when the root layout itself fails, so it brings its own <html>.
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
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
      </body>
    </html>
  );
}
