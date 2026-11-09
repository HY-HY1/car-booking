"use client";

import { useEffect } from "react";

// The body still has the business's colours from the root layout.
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="max-w-sm text-sm text-neutral-500">
        That didn&apos;t load properly. Your booking hasn&apos;t changed. Please try again.
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-4 inline-flex h-11 items-center rounded-full bg-brand px-5 font-medium text-brand-fg transition hover:opacity-90"
      >
        Try again
      </button>
    </main>
  );
}
