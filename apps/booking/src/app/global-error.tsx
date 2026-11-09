"use client";

import { useEffect } from "react";
import "./globals.css";

// Only when the root layout itself fails, so it brings its own <html>.
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col items-center justify-center gap-2 px-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="max-w-sm text-sm text-neutral-500">That didn&apos;t load properly. Please try again.</p>
        <button
          type="button"
          onClick={() => retry()}
          className="mt-4 inline-flex h-11 items-center rounded-full bg-brand px-5 font-medium text-brand-fg"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
