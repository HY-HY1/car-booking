"use client";

import { useActionState } from "react";
import { subscribeAction, type SubscribeState } from "./actions";

export function SubscribeForm({ token, businessName }: { token: string; businessName: string }) {
  const [state, action, pending] = useActionState<SubscribeState, FormData>(subscribeAction, {});

  if (state.done) {
    return (
      <p role="status" className="font-medium">
        You&apos;re subscribed. {businessName} will send you offers and news, with a link to stop in every email.
      </p>
    );
  }
  return (
    <form action={action} className="not-prose mt-6 grid justify-items-start gap-3">
      <input type="hidden" name="t" value={token} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 items-center rounded-full bg-accent px-6 font-medium text-accent-fg transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Subscribing…" : "Yes, send me offers"}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
